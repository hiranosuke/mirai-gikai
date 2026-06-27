---
name: bill-draft-from-archive
description: admin議会資料画面で生成された「議案ドラフト生成プロンプト」を受け取ったときに使う。DiscussCabinetからPDFを直接取得して内容を読み、mirai-gikaiの議案ドラフトJSONを生成してMCPで登録する。
---

# 議会資料PDFから議案ドラフトを生成する

admin の議会資料画面（`/assembly-archive`）で「プロンプトをコピー」して渡された
プロンプトを処理する。プロンプトには参照すべきPDFの取得パラメータ
（cabinetId / folderId / docid / fileId / fileName）がドキュメント単位で列挙されている。

## 処理手順

### 1. PDFを DiscussCabinet から直接取得する

DiscussCabinet（`https://www.discusscabinet.net/saitama`）は公開サーバーだが、
ファイル取得は2段階の POST が必要（GETの直リンク不可）。各 fileId ごとに以下を実行する。

```bash
# a. セッション確立（Cookie保存）。ファイル取得のたびに確立し直す
curl -s -c /tmp/dc_cookies.txt -X POST \
  https://www.discusscabinet.net/saitama/list \
  -H "Content-Type: application/x-www-form-urlencoded" -d ""

# b. PDFダウンロード（cabinet_id/folder_id/docid/fileid をプロンプトの値に置換）
#    file_view は 302 で実体URLへリダイレクトするため -L（追従）が必須。
#    付けないと 302・0バイトで失敗する。
curl -sL -b /tmp/dc_cookies.txt -X POST \
  https://www.discusscabinet.net/saitama/file_view \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "userid=&password=&cabinet_id=1&folder_id=123&docid=456&refer=&fileid=789&tmpid=&new_arrival=&order=&start=0&actions=return&filerefer=docview" \
  -o /tmp/archive_456_789.pdf
```

取得後、ファイル先頭が `%PDF` で始まることを確認する（HTMLエラーページが返っていないか）。

### 2. PDFの内容を読む

`Read` ツールで `/tmp/archive_<docid>_<fileId>.pdf` を読み、議案の本文・提出日・
提出者・議決結果などを把握する。

### 3. 議案ドラフトJSONを生成する

`admin/src/features/bills-edit/shared/types/bill-draft.ts` の `billDraftSchema` に従う。
主なフィールド:

- `billId`（省略=新規作成 / UUID指定=既存更新）
- `name`（必須・200文字以内）: 議案名
- `status`: `preparing` / `introduced` / `in_originating_house` / `in_receiving_house` / `enacted` / `rejected`
- `originating_house`: `HR` / `HC`（さいたま市議会は一院制のため通常 `HR`）
- `submitted_date`: `YYYY-MM-DD`
- `status_note`: ステータス備考（任意・500文字以内）
- `diet_session_id`: 会期ID（MCP `list_diet_sessions` で確認）
- `contents.normal` / `contents.hard`: `{ title, summary, content }`（ふつう/難しい）
- `tagIds`: タグUUIDの配列（MCP `list_tags` で確認）

### 4. 会期・タグを確認する

MCPツール `list_diet_sessions`・`list_tags` を呼び、対応する `diet_session_id` と
`tagIds` を決定する。該当が無ければ作成系ツール（`create_bill` 等の周辺ツール）も検討する。

### 5. MCPで登録する

MCPツール `upsert_bill_from_draft` に生成したJSONを渡す。複数議案がある場合は議案ごとに呼ぶ。

## 注意

- PDFの内容を要約・脚色しすぎない。原典に忠実に。固有名詞（個人名）は本文に含めない。
- 生成したJSONは登録前にユーザーに提示し、確認を取ること。
