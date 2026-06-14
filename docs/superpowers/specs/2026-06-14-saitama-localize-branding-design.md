# さいたま市版PoC Task2: 用語ローカライズ + FORK_GUIDELINES対応 設計

- 作成日: 2026-06-14
- ブランチ: `saitama/localize-branding`（ベース: `poc/saitama-mirai-gikai`）
- 関連: 増分2-task1（シード置換, PR #1 マージ済み）の後続。`FORK_GUIDELINES.md` 準拠を含む。

## 目的

国会（Diet）版として作られた `web` の表示を、さいたま市議会版に読み替える。あわせて
`FORK_GUIDELINES.md` の必須要件（サービス名・ロゴ・画像・カラー・免責文言）を満たし、
チームみらい本家サービスとの混同を防ぐ。

**「議案1本がトップ→詳細→インタビューまで通る」最小単位（task1で確認済み）を、見た目・用語の上でも
さいたま市版として成立させる**ことがゴール。

## スコープ

### 含む（このPR）
1. **表示コピーの読み替え**（ユーザーに見える日本語テキストのみ）
2. **ルート名 `kokkai` → `teireikai`**
3. **FORK_GUIDELINES 必須要件**（サービス名・カラー・ロゴ/画像・免責文言）
4. **チームみらい宣伝要素の除去**（免責文言と矛盾するため）

### 含まない（task3 / スキーマ整理へ送る）
- **コード識別子の変更**（`diet_sessions` / `diet-sessions` / `diet_session_id` / `originating_house` 等）。
  表示文字だけ変え、識別子・テーブル名・カラム名は据え置く。
- **二院制UIの構造改造**: 議案進捗バーの「衆議院審議→参議院審議」段階構造、`originating_house` の
  HR/HC=衆/参 ラベル。見える文字の最小読み替えに留め、二院→一院の段階再設計はしない。
- **AIチャットのプロンプト**（`web/src/lib/prompt/source-code/templates/shared-sections.ts` の
  チームみらい党説明）。インタビューチャットの挙動に関わるため task3 で扱う。

> **注記**: 進捗バー（`bill-status-progress.tsx`）の「衆議院審議 / 参議院審議」ラベルは構造改造に
> 直結するため、本PRでは触らず task3 に送る（既知の未整合として残す）。

## 設計判断（ブレストで確定）

| 項目 | 決定 | 理由 |
|------|------|------|
| primary カラー | `#2c8650`（さいたま市民マークの濃緑） | さいたま市の実ブランド色。チームみらい teal `#2aa693` と別色でFORK要件「primaryをそのまま使わない」を満たす |
| primary-accent | `#20603a`（primary の濃いめ派生） | hover/押下など濃色用途 |
| ロゴ | さいたま市民マーク（LOVE さいたま市） | ユーザー指定。header/footer/OGP/favicon/PWA に採用 |
| hero / OGP 背景 | 国会議事堂写真を廃し、市民マーク＋緑系のニュートラル差し替え | Diet固有のビジュアルを排除 |
| ルート slug | `kokkai` → `teireikai`（定例会） | 定例会の意味に合致 |
| チームみらい宣伝要素 | 除去 | 免責「チームみらいが運営しているものではない」と矛盾するため |
| サービス名 | 「みらい議会＠さいたま市」形式 | FORK_GUIDELINES の必須形式 |

### 市民マーク・マスコット（つなが竜ヌゥ）の利用について
さいたま市民マーク・つなが竜ヌゥとも、**非商用であれば申請不要で誰でも利用可能**（さいたま市の利用条件による）。
本PoCは非商用のため申請は不要。商用利用や規定変更時はさいたま市の最新の利用条件を確認すること。
- 市民マーク: https://www.city.saitama.lg.jp/006/012/001/007/p009133.html
- つなが竜ヌゥ: https://www.city.saitama.lg.jp/006/012/001/004/005/p010209.html

## 詳細設計

### 1. 表示コピーの読み替え

対象は `web/src` 内のユーザー可視テキスト。主なマッピング:

| 現行 | さいたま市版 |
|------|-------------|
| 国会 | さいたま市議会 / 市議会 |
| 法案 | 議案 |
| 国会会期 | 定例会 |
| 国会会期中 / 国会閉会中 | 会期中 / 閉会中 |
| 国会議事堂（hero alt） | さいたま市議会 |
| 「ご意見はチームみらいを通じて国会に届けられる可能性があります」 | 「ご意見はさいたま市議会に届けられる可能性があります」 |
| 「国会での審議に活用し」「国会答弁等において引用」 | 「さいたま市議会での審議に活用し」「市議会答弁等において引用」 |
| 内閣提出法案（bill-disclaimer の Diet固有説明） | さいたま市議会の議案に即した中立説明へ |

主な対象ファイル（確認済み・実装時に再grepで網羅する）:
- `web/src/app/layout.tsx`（description）
- `web/src/app/(main)/page.tsx`（セクションコメント/見出し）
- `web/src/app/(main)/terms/page.tsx`
- `web/src/components/top/hero.tsx` / `about.tsx` / `coming-soon-section.tsx`
- `web/src/components/layouts/desktop-menu/logo.tsx`（キャッチコピー）
- `web/src/features/chat/client/components/chat-window.tsx`（プレースホルダ/サジェスト）
- `web/src/features/interview-config/client/components/interview-lp-page.tsx`
- `web/src/features/interview-config/server/components/interview-disclosure-page.tsx`
- `web/src/features/bills/server/components/featured-bill-section.tsx` / `previous-session-section.tsx`
- `web/src/features/bills/client/components/bill-detail/bill-disclaimer.tsx`
- `web/src/features/bills/client/components/bill-list/compact-bill-card.tsx`（コメント）
- `web/src/features/bills/client/components/share/bill-share-modal.tsx`
- `web/src/features/diet-sessions/client/components/diet-session-bill-list.tsx` / `current-diet-session.tsx`

実装方針: **機械的な全置換はしない**。文脈ごとに（市議会/定例会/議案）を選び、コード識別子・
テスト・AIプロンプトテンプレートは除外する。実装後に `国会|法案|衆議院|参議院` を再grepし、
意図的に残すもの（task3送り）以外が残っていないか確認する。

### 2. ルート名 `kokkai` → `teireikai`

- `web/src/lib/routes.ts`: `kokkaiSessionBills` → `teireikaiSessionBills`、URL `/kokkai/${slug}/bills` → `/teireikai/${slug}/bills`
- ディレクトリ `web/src/app/(main)/kokkai/[slug]` → `web/src/app/(main)/teireikai/[slug]`
- 利用箇所 `web/src/features/bills/server/components/previous-session-section.tsx`（`routes.kokkaiSessionBills`）を更新
- `web/src/lib/routes.test.ts`: page.tsx 同期テストが通るよう更新（新ルート関数を追加/改名）
- 他に `/kokkai` を直書き・参照している箇所がないか実装時に grep して網羅

### 3. FORK_GUIDELINES 必須要件

#### 3-1. サービス名（`web/src/app/layout.tsx`）
- `siteTitle`: `"みらい議会｜チームみらい"` → `"みらい議会＠さいたま市"`
- `siteName`: `"みらい議会"` → `"みらい議会＠さいたま市"`
- `description`: 「国会で…」→「さいたま市議会で今どんな議案が…」
- `keywords`: チームみらい/日本 → さいたま市/市議会 系に調整
- `themeColor`: `#2aa693` → `#2c8650`

#### 3-2. カラー（`web/src/app/globals.css`）
- `--primary: #2aa693` → `#2c8650`
- `--primary-accent: #0f8472` → `#20603a`
- グラデーション等のチームみらい teal を参照するトークンが存在すれば同系の緑へ更新
  （実装時に `#2aa693` / `#0f8472` / `mirai-gradient` 等を grep して該当箇所を網羅）

#### 3-3. ロゴ・画像・アイコン
- header/footer ロゴ（`logo.tsx`、`web/public/img/logo.svg`、`team-mirai-typography.svg` 参照箇所）→ さいたま市民マークへ
- `web/public/img/ogp-logo.png` → 市民マーク
- `web/public/img/hero_background.png`（現: 国会議事堂）→ 市民マーク＋緑系のニュートラルなビジュアルへ
- `web/public/ogp.jpg` → 同上
- `web/public/icons/pwa/*`（192/ios 等）→ 市民マークを正方形パディングで生成
- favicon → 市民マーク

> 画像生成は macOS `sips` 等で市民マーク（GIF/PNG）から必要サイズを作る。元画像は横長(290x200)のため
> 正方形アイコンは余白パディングして中央配置する。

#### 3-4. 免責文言（フッター）
- フッターに以下を表示:
  > これは政党チームみらいが運営しているものではありません
- 本家「みらい議会」へのリンク（https://gikai.team-mir.ai/ ）を併記
- 配置: `web/src/components/layouts/footer/footer.tsx` / `footer.config.ts`

### 4. チームみらい宣伝要素の除去

- トップの `web/src/components/top/team-mirai.tsx` セクション（安野貴博 参議院議員… の紹介）を**除去**し、
  `page.tsx` から該当セクションの描画を外す
- フッター `footer.config.ts` の `primaryLinks` から「チームみらいについて」「寄附で応援する」を除去
- 「みらい議会とは」（本家noteへの外部リンク）は**残す**。FORK_GUIDELINES の推奨「本家へのリンク掲載」に
  合致し、免責文言（本家とは別運営である旨）とも整合するため
- 除去により未使用化する import / アセット参照を片付ける

## テスト方針

CLAUDE.md / テストガイドラインに従う。本PRは表示文字・ルート・静的アセット中心で純粋ロジック追加は少ない。

- **ルート定義**: `web/src/lib/routes.test.ts`（page.tsx 同期テスト）が `teireikai` リネーム後も通ること。
  必要に応じてテストを更新。
- **既存テスト**: `国会`/`法案` 等の文字列を期待している既存テスト（例 `bills/shared/types/index.test.ts`、
  `bill-status.test.ts`、`bill-progress.test.ts`）が**スコープ外の識別子/ラベルに依存していないか**確認。
  task3送りの 衆/参 ラベルやenumに触れていなければ変更不要。表示文言を変えた箇所のテストは追随更新。
- **純粋関数の新規切り出しは想定しない**（主に文言・アセット差し替えのため）。新たに切り出す場合は
  同階層に `*.test.ts` を追加する。
- **ローカル検証**: `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm test` を push 前に通す。
- **画面確認**: トップ→定例会一覧→議案詳細→インタビューLP を実際に開き、
  (a) 国会用語が残っていない（task3送り以外）、(b) カラー/ロゴ/サービス名が反映、
  (c) 免責文言とフッターが表示、(d) `/teireikai/...` で到達できることを確認。
  **PRへのスクリーンショット添付は不要**（ユーザー自身がブラウザで最終確認するため、`/pr-screenshot` は実行しない）。

## リスク / 既知の未整合（task3へ）

- 議案進捗バーの「衆議院審議 / 参議院審議」表記、`originating_house` の HR/HC ラベルは本PRで未対応。
- AIチャットのチームみらい党説明プロンプトは未対応（チャットの応答には影響が残る）。
- 市民マーク・つなが竜ヌゥは非商用なら申請不要で利用可（商用利用時はさいたま市の利用条件を確認）。

## 完了条件

1. 上記スコープの表示コピー・ルート・FORK要件・宣伝要素除去が反映されている。
2. `lint` / `typecheck` / `build` / `test` がローカルで通過。
3. 画面確認4項目（上記テスト方針）をクリア。
4. `/simplify` → `/review` 通過後、`poc/saitama-mirai-gikai` をベースに PR 作成（スクリーンショット添付なし）。
