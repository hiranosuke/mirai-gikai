# 議会資料アーカイブ（assembly-archive）設計

作成: 2026-06-20 / 対象: admin / 増分3-A 第1段（議事録→議案コンテンツ供給フローの素材取得部分）

## 1. 背景と目的

さいたま市議会の資料は [DiscussCabinet（さいたま市議会資料検索システム）](https://www.discusscabinet.net/saitama/) で公開されている。運用者が議案コンテンツ（`bill_contents`）を作る際、原典資料（議案本文・審議結果・補正予算概要など）をこのシステムから探す必要がある。

しかし DiscussCabinet は以下の理由で「探す」コストが高い（`docs/saitama_gikai_search_manual.md` §8.4, §10）:

- 画面遷移の大半が **POST送信**で、URLでは状態を再現できない。
- 目的のPDFに辿り着くまで `TOP→文書一覧→本会議→年→定例会→日付→文書詳細→PDF` と**多段のページ遷移**が必要。

本増分は、この「探す」を楽にする。**admin内で文書ツリーを辿り、文書を選ぶと本文テキストと原典リンクが表示される**ブラウザを提供する。取得した本文は運用者がコピーして外部AIに渡し、外部AIが**既存のMCP**（`create_bill` / `update_bill_contents` / `update_bill_tags` 等）で議案を作成・更新する。

### スコープ（やること）

- DiscussCabinet クライアント/パーサ層（保存方式に依存しない再利用可能な層）。
- ライブ・遅延プロキシ方式（DB保存なし、ツリー展開・文書選択時に DiscussCabinet へ中継取得）。
- admin の新規 feature `assembly-archive` とページ（遅延展開ツリー＋文書詳細パネル）。

### 非ゴール（やらないこと）

- DBキャッシュ／同期ジョブ（後述の「将来の方式2」）。本増分はクライアント層を流用可能な形に設計するに留める。
- PDF実体の直ダウンロード／OCR。`file_view` は不安定なため、PDFは「DiscussCabinet入口リンク＋文書ID/ファイルID/ファイル名の表示」で代替する。
- AI生成・JSON投入・議案（`bill_contents`）への反映。これらは既存MCPが担う／次段で扱う。
- web側（公開アプリ）への反映。

### この第1段のゴール

「探す」を楽にする。出力は**クリーンな本文テキスト＋追跡用メタ**（件名・日付・フォルダパス・文書ID・ファイルID・取得日）。

## 2. DiscussCabinet 通信仕様（実調査ベース）

2026-06-20 に実際の挙動を調査して確定した仕様。すべて `https://www.discusscabinet.net/saitama/` 配下。

### セッション

- 初回 `POST /saitama/list`（body空）で session cookie が発行される（認証不要）。
- 以降のリクエストで cookie を引き回す。cookie は loader 呼び出しごとに使い捨て（loader内で確立 → 目的の遷移を実行）。

### 子ノード取得（フォルダ／文書一覧）

- `POST /saitama/list`
- 主なパラメータ: `cabinet_id`, `folder_id`, `move`(`down` / ルートキャビネット選択時は `cabinet`), `order`, `start`, `docid`, `refer`。
- `cabinet_id` + `folder_id` を直接指定すれば、前回の展開状態に依存せず**任意フォルダへ一発で到達できる**ことを確認済み（ステートレスに再現可能）。
- 確認済みID例: 本会議 `cabinet_id=1`、令和8年 `folder_id=212526`、6月定例会 `223218`、審議結果 `224514`。フォルダIDは安定した数値。

### 文書詳細

- `POST /saitama/doc_view`
- パラメータ: `cabinet_id`, `folder_id`, `docid`。
- 応答（文書詳細画面HTML）から抽出できるもの:
  - **本文テキスト**: 「本文テキスト:」セル隣接の `td`。実用的なテキストが取れるケースを確認（例: 議案審議結果一覧 docid `15337` で「議案番号 提出日 件名 議決結果 議決日 第106号 令和8年6月3日 専決処分の報告...」）。
  - **ファイル一覧**: `setFile('17114')` + ファイル名（例: `令和８年６月定例会議案審議結果一覧.pdf`）。
  - **メタ**: 件名・日付・フォルダパス・文書ID。

### PDF（非ゴール）

- `file_view` への単純POSTは「エラー画面」を返し、実体取得は不安定（フォーム完全再現や順序依存があると見られる）。
- 本増分では PDF実体を取得しない。文書詳細に「DiscussCabinetで開く」入口リンクと文書ID/ファイルID/ファイル名を表示するに留める。

### HTML構造の抽出ポイント

- フォルダ: `button.folder_icon` の `onclick="...setFolderid('<folderId>','down')..."` と `title` 属性。
- 文書: `onclick="doSubmitWithDocid('doc_view',<docid>)"` を持つ「詳細」ボタンと、行内の件名。
- 本文: 「本文テキスト:」の `th` の隣接 `td` の text。
- ファイル: `onclick="...setFile('<fileId>')..."` とリンクテキスト（ファイル名）。
- エラー画面: `<title>エラー画面</title>` で検知。

## 3. アーキテクチャ（レイヤー構成）

admin の Bulletproof React feature 構成に沿って新規 feature `assembly-archive` を作る。

```
admin/src/features/assembly-archive/
├── server/
│   ├── clients/
│   │   └── discuss-cabinet-client.ts   # POST中継 + セッション確立（fetch層）
│   ├── parsers/
│   │   ├── parse-folder-list.ts        # list応答HTML → { folders[], documents[] }
│   │   └── parse-doc-view.ts           # doc_view応答HTML → { bodyText, files[], meta }
│   ├── loaders/
│   │   ├── load-tree-children.ts       # (cabinetId, folderId) → 子ノード
│   │   └── load-document-detail.ts     # docid → 本文 + メタ + 原典リンク
│   ├── actions/
│   │   ├── fetch-tree-children.ts      # "use server" Client から子ノード取得
│   │   └── fetch-document-detail.ts    # "use server" Client から文書詳細取得
│   └── utils/
│       └── build-folder-path.ts        # パンくず生成（純粋関数）
├── client/
│   └── components/
│       ├── archive-tree.tsx            # 遅延展開ツリー（"use client"）
│       └── document-detail-panel.tsx   # 本文表示 + コピー + 原典リンク
└── shared/
    └── types/
        └── index.ts                    # CabinetNode / FolderNode / DocumentNode / DocumentDetail
```

### 責務の分離（将来の方式2移行の肝）

- `clients/` … HTTP POST中継とセッションcookie確立のみ。入力=ID等、出力=生HTML文字列。**外部API扱い**でインターフェース化し、テストでは Fake に差し替える。
- `parsers/` … 生HTML → 型付き構造への**純粋関数**（外部依存なし）。テスト必須。
- `loaders/` … client + parser を束ねる。将来はここを「DB読み」に差し替えるだけで方式2へ移行できる。
- `actions/` … Client Component からの遅延取得用 Server Actions。loader を呼ぶ薄いラッパー。

### データ取得経路（遅延ロード）

- 初期表示: ルート（キャビネット一覧: 本会議 / 委員会 / マニュアル）を Server Component で表示。
- ノード展開: Client が `(cabinetId, folderId)` を Server Action `fetchTreeChildren` に渡す → loader が `client.fetchList()` → `parseFolderList()` → 子ノード（フォルダ＋文書）を返す。
- 文書クリック: `docid` を Server Action `fetchDocumentDetail` に渡す → `load-document-detail` → 本文テキスト＋ファイル一覧＋メタ。

### HTMLパース手段

`node-html-parser`（軽量・依存少）を admin に追加。属性順序・空白・改行・入れ子テーブルに強く、外部サイトのHTML微変更に対して正規表現より堅牢。本文テキストの入れ子テーブル抽出は特にパーサが有利。

### 将来の方式2（DBキャッシュ）への発展

理想は cabinets / folders / documents を Supabase に保存して高速・堅牢に表示する方式。本増分では実装しないが、`clients/` と `parsers/` を保存非依存に作るため、将来は「同期サービスが同じ client + parser を呼び、結果を DB に書く」「loader を DB読みに差し替える」だけで移行できる。取得・解析ロジックは無改修で流用する。

## 4. エラー処理・限界

- **エラー画面／想定外構造**: パーサが `<title>エラー画面</title>` や必須要素の欠如を検知し、loader は「取得失敗（DiscussCabinet側の構造変更または一時障害の可能性）」をUIへ返す。**空配列を成功扱いしない。**
- **本文テキストが空／文字化け**: 一部文書で起こりうる（マニュアル §10）。本文が薄い場合はUIに「本文テキストが取得できませんでした。原典PDFをご確認ください」＋入口リンクを表示する。
- **外部依存・遅延**: 展開ごとに数百ms〜の外部往復。UIはローディング表示。タイムアウト（例: 20秒）でエラー表示。
- **多重リクエスト抑制**: 連打展開時、展開中ノードの再要求はUI側で無視する。

## 5. テスト方針（CLAUDE.md 準拠）

- **パーサは純粋関数**: 実取得した応答HTMLをフィクスチャとして `__fixtures__/` に保存し、`parse-folder-list.test.ts` / `parse-doc-view.test.ts` で検証する。ケース: フォルダ抽出・文書抽出・本文抽出・エラー画面検知・本文空。調査済みの実HTML（list / doc_view / エラー画面）をそのまま使える。
- **`build-folder-path` 等のutilは純粋関数＋テスト必須**。
- **client（fetch層）は外部API扱い**: インターフェースを定義し、テストでは Fake 実装に差し替える（CLAUDE.md「外部APIはDIでモック」準拠）。loader のテストは Fake client + 実HTMLフィクスチャで行う。
- **実 DiscussCabinet への通信テストはしない**（外部・不安定）。

## 6. UI構成

- admin ナビに「議会資料」を追加。`admin/src/lib/routes.ts` にルート関数を追加（`routes.test.ts` が page.tsx との同期を検証）。
- レイアウト: 左に**遅延展開ツリー**（キャビネット→年→定例会→…→文書）、右に**文書詳細パネル**。
- 文書詳細パネルの表示項目: 件名・日付・フォルダパス（パンくず）・本文テキスト（**コピーボタン**付き）・ファイル一覧（ファイル名＋ファイルID）・DiscussCabinet入口リンク・取得日。
- スタイル規約: ボタンは `@/components/ui/button` の `Button`、アイコンは `lucide-react`、色は `globals.css` のデザイントークン（インラインカラー禁止）。

## 7. 受け入れ条件

- admin の新規ページで、ログイン不要のキャビネット一覧から本会議→年→定例会→…→文書まで**遅延展開で辿れる**。
- 文書を選ぶと、本文テキスト・メタ・ファイル一覧・DiscussCabinet入口リンクが表示され、**本文をコピーできる**。
- DiscussCabinet がエラー画面／想定外構造を返した場合、失敗が明示される（空表示で成功扱いしない）。
- 本文が取得できない文書では、その旨と原典リンクが表示される。
- パーサ・util の純粋関数にテストがあり、`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` が通る。
