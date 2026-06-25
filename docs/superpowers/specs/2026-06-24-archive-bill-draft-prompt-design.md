# 設計: 議会資料ツリーから議案ドラフト生成プロンプトを作る機能

作成日: 2026-06-24
対象: admin `assembly-archive` feature + Claude Code スキル
ベースブランチ: `poc/saitama-mirai-gikai`

## 背景・目的

admin の「議会資料」画面（`/assembly-archive`）は DiscussCabinet の本会議・委員会
ツリーを表示し、文書クリックで本文テキストと添付 PDF を閲覧できる。

この画面のツリーに **ファイル単位のチェックボックス** を追加し、選択した PDF を
参照する **議案ドラフト生成プロンプト** を生成してクリップボードにコピーできる
ようにする。コピーしたプロンプトを Claude Code に渡すと、Claude Code が
DiscussCabinet から PDF を直接取得して内容を読み、mirai-gikai の議案ドラフト JSON を
生成し、MCP 経由で議案を登録する。

### 設計上の確定事項（ユーザーとの議論で確定）

- **PDF はテキストではなく「取得元情報」をプロンプトに埋め込む**。本文テキストを
  MCP / プロンプトに埋め込む方式はデータ欠落リスクを避けるため採用しない。
- **admin プロキシ URL を LLM に渡さない**（admin への直アクセスに抵抗あり）。
- **Claude Code が DiscussCabinet へ直接 POST する**。DiscussCabinet は公開サーバーで、
  セッション確立 → file_view の2段階 POST で PDF を取得できる。admin サーバー・
  認証トークン・新規 MCP ツールは不要。
- **選択粒度はファイル単位**。加えてドキュメント単位の「全選択」も用意する。

## 全体構成

```
[admin UI]                          [Claude Code]
ツリーでファイル選択                 プロンプトを受け取る
  → プロンプト生成                    → DiscussCabinet へ直接 curl POST
  → クリップボードコピー  ──────▶     → PDF を Read ツールで読む
                                      → 議案ドラフト JSON 生成
                                      → MCP upsert_bill_from_draft で登録
```

## UI 変更

### `archive-tree.tsx`: DocumentRow → DocumentItem + FileRow

現状の `DocumentRow`（クリックで詳細表示するボタンのみ）を次の構造に置き換える。

```
[ ▶ ] [☐] 文書タイトル              ← DocumentItem（タイトルクリックで詳細表示は維持）
        ☐ 会議録.pdf                 ← FileRow（展開時に表示）
        ☐ 資料1.pdf
```

- **展開ボタン（▶ / ▼）**: クリックで `fetchDocumentDetail` を呼びファイル一覧を
  取得して展開。取得済みならトグルのみ。loading/error 表示は ExpandableFolder と同様。
- **ドキュメントチェックボックス**: 「全選択」。未展開ならまず展開し、取得した全
  ファイルを選択。展開済みなら全ファイルをトグル。状態は配下ファイルの選択状況から
  導出（全選択=checked / 一部=indeterminate / 0件=unchecked）。
- **タイトル**: 引き続きクリックで右の `DocumentDetailPanel` に表示（既存動作を維持）。
- **FileRow**: 各 PDF に個別チェックボックス。

> 注: チェックボックスは既存の `@/components/ui/checkbox`（Radix ベース、導入済み・
> `indeterminate` 状態対応）を使う。インライン SVG・素の `<button>` は禁止。

### `archive-browser.tsx`: 選択状態と PromptPanel

選択状態を保持する。

```ts
type SelectedFile = {
  doc: DocumentNode;       // cabinetId / folderId / docid / title / date
  fileId: number;
  fileName: string;
};
// Map のキー: `${docid}-${fileId}`
const [selectedFiles, setSelectedFiles] = useState<Map<string, SelectedFile>>(new Map());
```

`ArchiveTree` には以下を props で渡す:

- `isFileSelected(docid, fileId): boolean`
- `onToggleFile(file: SelectedFile): void`
- `onToggleAllFiles(doc, files: DocumentFile[]): void`（全 ON or 全 OFF）

1件以上選択されたら、グリッド下部に `PromptPanel` を表示する。

### `prompt-panel.tsx`（新規 Client Component）

```
┌───────────────────────────────────────────────┐
│  3ファイル選択中                              │
│  [プロンプトをコピー]  [選択をクリア]         │
└───────────────────────────────────────────────┘
```

- 「プロンプトをコピー」: `buildBillDraftPrompt(selectedFiles)` の結果を
  `navigator.clipboard.writeText` でコピー。コピー済み表示（既存 DetailPanel と同様）。
- 「選択をクリア」: `selectedFiles` を空にする。

## プロンプト生成（純粋関数）

### `shared/utils/build-bill-draft-prompt.ts`

```ts
export function buildBillDraftPrompt(files: SelectedFile[]): string
```

- ファイルを `docid` でグルーピングし、ドキュメント見出し + ファイル行を生成。
- 各ファイル行に `cabinetId / folderId / docid / fileId / fileName` を明記。
- 冒頭に Claude Code スキル（`bill-draft-from-archive`）への参照と処理指示を入れる。

出力イメージ:

```
以下のさいたま市議会の会議資料PDFを参照して、mirai-gikai の議案ドラフトを
作成してください。`bill-draft-from-archive` スキルに従って処理してください。

## 参照資料

### 議案 第○号（docid: 456）
- 議案書.pdf  cabinetId=1  folderId=123  docid=456  fileId=789
- 参考資料.pdf  cabinetId=1  folderId=123  docid=456  fileId=790

### 委員会審査報告書（docid: 457）
- 報告書.pdf  cabinetId=2  folderId=124  docid=457  fileId=791
```

純粋関数なので `build-bill-draft-prompt.test.ts` を同階層に必ず作成する
（単一/複数ドキュメント、複数ファイル、グルーピング順序のテスト）。

## Claude Code スキル

### `.claude/skills/bill-draft-from-archive/SKILL.md`（新規）

処理手順を定義する:

1. プロンプトから各ファイルの `cabinetId / folderId / docid / fileId` を読み取る。
2. 各 PDF を DiscussCabinet から直接取得:
   ```bash
   # a. セッション確立（Cookie 保存）
   curl -s -c /tmp/dc_cookies.txt -X POST \
     https://www.discusscabinet.net/saitama/list \
     -H "Content-Type: application/x-www-form-urlencoded" -d ""
   # b. PDF ダウンロード
   curl -s -b /tmp/dc_cookies.txt -X POST \
     https://www.discusscabinet.net/saitama/file_view \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "cabinet_id=1&folder_id=123&docid=456&fileid=789&actions=return&filerefer=docview&start=0" \
     -o /tmp/archive_<docid>_<fileId>.pdf
   ```
   ※ セッションは file_view ごとに establishSession し直す挙動を踏襲（クライアント実装に準拠）。
3. `Read` ツールで PDF テキストを読む。
4. PDF 内容から `billDraftSchema`（`admin/src/features/bills-edit/shared/types/bill-draft.ts`）に
   沿った議案ドラフト JSON を生成。会期・タグは MCP `list_diet_sessions` / `list_tags` で確認。
5. MCP `upsert_bill_from_draft` で登録（billId 省略=新規、指定=更新）。

スキルには billDraftSchema の主要フィールド（name / status / originating_house /
submitted_date / contents.normal / contents.hard / tagIds 等）と enum 値を明記し、
LLM が正確な JSON を作れるようにする。

## ファイル一覧

| ファイル | 種別 |
|---|---|
| `assembly-archive/shared/types/index.ts` | 変更（`SelectedFile` 型追加） |
| `assembly-archive/shared/utils/build-bill-draft-prompt.ts` | 新規（純粋関数） |
| `assembly-archive/shared/utils/build-bill-draft-prompt.test.ts` | 新規 |
| `assembly-archive/client/components/archive-tree.tsx` | 変更（DocumentItem + FileRow） |
| `assembly-archive/client/components/archive-browser.tsx` | 変更（選択状態 + PromptPanel） |
| `assembly-archive/client/components/prompt-panel.tsx` | 新規 |
| `.claude/skills/bill-draft-from-archive/SKILL.md` | 新規 |

> `components/ui/checkbox.tsx` は導入済みのため新規作成不要。

## テスト方針

- `build-bill-draft-prompt.test.ts`: 純粋関数のユニットテスト（必須）。
- UI コンポーネントはロジックを純粋関数に寄せ、選択状態の導出
  （全選択/一部選択/未選択の判定）も純粋関数に切り出してテストする。

## スコープ外

- admin サーバーへの認証トークン追加（不採用）。
- bodyText を返す MCP ツール（不採用）。
- Claude.ai（Web）対応。本機能は Claude Code 前提。
- 既存の DocumentDetailPanel の本文表示・コピー機能（変更しない）。
