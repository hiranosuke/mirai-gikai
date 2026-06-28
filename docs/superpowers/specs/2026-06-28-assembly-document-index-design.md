# 議会資料メタデータインデックス 設計

作成日: 2026-06-28
対象: admin / DiscussCabinet 連携 / MCP

## 1. 背景と目的

DiscussCabinet（さいたま市議会資料検索システム）から目的の議案・関連資料を見つけるのが難しい。現状は admin の assembly-archive ツリーを毎回ライブで歩き（POST リクエスト）、`bill-draft-from-archive` スキルが PDF を直接読む流れで、資料に関する情報は一切永続化されていない。

そのため、

- 同じ資料に到達するたびにツリーを再走査する必要がある。
- 本家の全文検索はキーワード依存でノイズが多い（マニュアル例: `大宮駅` で 1446 件）。
- AI/MCP からは「この会期のこのテーマの資料はどれか」を効率的に特定できない。

本設計では、PDF 本文は読み込まず、**各資料の軽量メタデータ（admin に表示できる情報＋ docid 等の識別子）を DB に取り込む**。これにより MCP/AI からの検索性を上げる。データ量を抑えるため、取り込みは**年度＋会期を起点とした手動のフォルダサブツリー単位**とする。

参考: [docs/saitama_gikai_search_manual.md](../../saitama_gikai_search_manual.md) の §3（文書データの構造）、§8.3（推奨データ項目）。

### 主な利用者

- 現時点: **MCP/AI**（議案ドラフト生成ワークフロー）。
- 将来: admin UI からの閲覧、一般公開も視野に入れるが、本設計では作り込まない（YAGNI）。データモデルは将来の admin/公開に耐えるクリーンさを保つ。

### 想定ユースケース（重要）

「議案の概要をもとに下書きだけ作成済みの bill について、関連すると思われる詳細資料を AI エージェントに同じ会期内で検索させ、PDF を深掘りさせる」。

実現フロー:

1. AI は対象 bill の draft（件名・概要）を持っている。
2. `search_assembly_documents({ query: 件名のキーワード, sessionLabel: "令和8年6月定例会", cabinetId? })` を呼ぶ。
3. 返ってきた候補（審議結果一覧・委員会要求資料・質問通告書など）の `cabinetId / folderId / docid` を、既存の bill-draft ワークフロー（doc_view → PDF 取得）にそのまま渡す。
4. AI が PDF を読んで詳細を肉付け、または審議結果で status を更新する。

「メタ DB で会期内に当たりをつけて絞り込み → 既存 PDF 取得で深掘り」の二段構え。

## 2. スコープ

### やること

- DiscussCabinet のフォルダサブツリーを軽量クロールし、フォルダ・文書メタデータを DB に upsert する共通サービス。
- admin UI に「年度＋会期」を起点とした取り込みトリガー（ボタン）。
- MCP ツール `search_assembly_documents`（件名検索＋会期/キャビネット/日付フィルタ）。
- 会期ラベル正規化（パス → `令和8年6月定例会`）などの純粋関数とテスト。

### やらないこと（YAGNI）

- PDF 本文・fileId・fileName の保存（必要時に既存 `fetchDocView` で遅延取得）。
- 全文検索（tsvector / pg_trgm）。ILIKE 件名検索で開始し、必要になれば後付け。
- admin 閲覧 UI・一般公開 UI。
- bill と assembly_documents のリレーション（将来 `sessionLabel` を bill から自動補完する余地は残すが今は手動指定）。
- 自動・定期クロール。手動のみ。

## 3. データモデル

新規マイグレーションで 2 テーブルを追加する。両テーブルとも RLS を有効化し**ポリシーは定義しない**（デフォルト全拒否、`createAdminClient()` 経由のみアクセス）。

```sql
create table assembly_folders (
  folder_id        bigint primary key,        -- DiscussCabinet のフォルダID
  cabinet_id       bigint not null,           -- 1=本会議, 2=委員会
  parent_folder_id bigint,                    -- ルート取込点は null
  name             text not null,
  path             text not null,             -- 例: /本会議/令和８年/６月定例会/審議結果/
  imported_at      timestamptz not null default now()
);
alter table assembly_folders enable row level security;

create table assembly_documents (
  id            uuid primary key default gen_random_uuid(),
  cabinet_id    bigint not null,
  folder_id     bigint not null,              -- assembly_folders.folder_id
  docid         bigint not null,
  title         text not null,
  doc_date      date,                         -- 正規化済み。失敗時は null
  raw_date      text,                         -- 元の表示文字列をそのまま保持
  folder_path   text not null,               -- 文書カードに直接出せるよう非正規化
  session_label text,                         -- 例: "令和8年6月定例会"（パスから導出）
  imported_at   timestamptz not null default now(),
  unique (cabinet_id, docid)
);
alter table assembly_documents enable row level security;

create index assembly_documents_session_idx on assembly_documents (session_label);
create index assembly_documents_cabinet_idx on assembly_documents (cabinet_id);
```

補足:

- `folder_id` に外部キー制約は張らない（クロール順序やルート取込点で folder 行が無いケースを避けるため、アプリ層で整合を担保）。
- 件名検索は当面 `title ILIKE %query%`。日本語の部分一致は本家の検索運用と整合する。必要になれば `pg_trgm` GIN を後付けする。

## 4. 取り込み（クロール）

### 共通サービス

`admin/src/features/assembly-archive/server/services/import-assembly-subtree.ts`（`"server-only"`）に新設。

```
importAssemblySubtree({ cabinetId, folderId, basePath }):
  Promise<{ folderCount: number; documentCount: number }>
```

挙動:

- 起点フォルダから `fetchFolderList({ cabinetId, folderId, move: "down" })` → `parseFolderList` を**逐次・再帰**で降りる。
- 各階層で得たサブフォルダ・文書を `assembly_folders` / `assembly_documents` に upsert（`assembly_documents` は `(cabinet_id, docid)` で衝突更新、`imported_at` も更新）。冪等。
- `path` は降下しながら `basePath` に名前を連結して構築。`session_label` は純粋関数 `deriveSessionLabel(path)` で導出。
- DiscussCabinet への負荷配慮: リクエストは逐次、各リクエスト間に小休止（例: 200ms）。
- 暴走防止: 最大深さ・最大文書数のガード定数を `shared/constants.ts` に置き、超過時はエラーで停止。

### 純粋関数（テスト必須）

`shared/utils/` に配置:

- `deriveSessionLabel(path: string): string | null` — パスから `令和8年6月定例会` を導出。本会議（`/本会議/令和８年/６月定例会/...`）と委員会（`/委員会/令和8年/予算委員会/6月定例会/...`）の両ネスト構造に対応。全角/半角・和暦表記ゆれを正規化。
- `parseDocDate(raw: string): string | null` — 表示日付を `YYYY-MM-DD`（date 文字列）へ。失敗時 null。

## 5. 取り込みトリガー（admin UI）

- 既存 assembly-archive ツリー画面に、**年度→会期のガイド付きピッカー**を置く。
  - **本会議**: 会期は単一フォルダ（`本会議/令和8年/6月定例会/`）。ピッカーで選ぶとその会期フォルダを起点に取り込み。
  - **委員会**: 会期は各委員会の下にネスト（`委員会/令和8年/予算委員会/6月定例会/`）。委員会キャビネットは「年度配下のサブツリー」または「特定委員会の会期フォルダ」を起点に取り込む。どのサブツリーから取り込んでも `session_label` 正規化により検索は会期で横断できる。
- ボタン押下 → Server Action `import-assembly-subtree-action.ts` が共通サービスを呼ぶ。
- 完了後、取り込んだフォルダ数・文書数を UI に表示。
- 同一起点の再実行は upsert で更新（冪等）。

## 6. 検索（MCP）

新ツール `search_assembly_documents` を `admin/src/features/mcp/server/tools/register-assembly-tools.ts` に追加し、`create-handler.ts` で登録。

```
入力:
  query           string  任意   -- 件名の部分一致
  sessionLabel    string  任意   -- 例: "令和8年6月定例会"（既定の絞り込み軸）
  cabinetId       number  任意   -- 1=本会議, 2=委員会
  dateFrom        string  任意   -- YYYY-MM-DD
  dateTo          string  任意   -- YYYY-MM-DD
  limit           number  任意   -- 既定 50

出力（配列）:
  title, docDate, folderPath, sessionLabel, cabinetId, folderId, docid
```

- リポジトリ層 `assembly-archive/server/repositories/assembly-document-repository.ts` に検索クエリを集約。
- クエリは `title ILIKE %query%` ＋ 指定フィルタ（sessionLabel / cabinetId / 日付範囲）。
- 出力の `cabinetId / folderId / docid` は既存 bill-draft ワークフロー（doc_view → PDF 取得）にそのまま渡せる形にする。
- AI には「会期内に絞って検索する」運用を促すよう description に明記。

## 7. ファイル構成（追加・変更）

```
supabase/migrations/
  <timestamp>_create_assembly_document_index.sql           # 新規

packages/supabase/types/supabase.types.ts                  # 再生成

admin/src/features/assembly-archive/
  shared/constants.ts                                       # クロール上限定数を追加
  shared/utils/derive-session-label.ts(+test)              # 新規
  shared/utils/parse-doc-date.ts(+test)                    # 新規
  server/services/import-assembly-subtree.ts                # 新規
  server/repositories/assembly-document-repository.ts       # 新規
  server/actions/import-assembly-subtree-action.ts          # 新規
  client/components/...                                      # 年度→会期ピッカー＋取込ボタン

admin/src/features/mcp/server/
  tools/register-assembly-tools.ts                          # 新規
  create-handler.ts                                         # ツール登録を追加
```

## 8. テスト方針

- `deriveSessionLabel` / `parseDocDate` は純粋関数として `*.test.ts` 必須（本会議・委員会の両パス、和暦/全角半角の表記ゆれ、変換失敗ケース）。
- 既存 `parseFolderList` のテストは流用（クロールはこのパーサに依存）。
- リポジトリ検索クエリはローカル Supabase 実体に接続して検証（モックしない）。
- DB function（RPC）は追加しないため `tests/supabase/db-function/` の統合テストは不要。
- 外部 API（DiscussCabinet fetch）は既存の `FetchLike` DI でフェイクに差し替えてサービスのクロール挙動をテスト。

## 9. 段階的実装の想定順序

1. マイグレーション＋型再生成。
2. 純粋関数（`deriveSessionLabel` / `parseDocDate`）＋テスト。
3. リポジトリ（upsert / 検索）＋テスト。
4. クロールサービス（DI でフェイク fetch）＋テスト。
5. MCP ツール `search_assembly_documents` 登録。
6. admin UI（年度→会期ピッカー＋取込ボタン＋Server Action）。

## 10. 未決事項 / 将来拡張

- 件名以外（folder_path 等）への検索拡張は需要を見て判断。
- bill ↔ assembly_documents の関連付け、`sessionLabel` の bill からの自動補完。
- 一般公開時のテーマ/事業単位の再構成（マニュアル §8.5）。
- pg_trgm によるあいまい検索。
