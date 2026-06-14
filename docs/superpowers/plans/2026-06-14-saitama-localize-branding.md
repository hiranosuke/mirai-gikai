# さいたま市版 用語ローカライズ + FORK対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 国会版 `web` の表示・ルート・ブランドをさいたま市議会版に読み替え、FORK_GUIDELINES 必須要件を満たす。

**Architecture:** 表示文字列・静的アセット・カラートークンの差し替えが中心。コード識別子（`diet_sessions` 等）・二院制UI構造・AIプロンプトは触らず task3 に残す。ルート `kokkai`→`teireikai` のみ構造変更。

**Tech Stack:** Next.js (App Router) / Tailwind v4 (`@theme inline` トークン) / Biome / Vitest / macOS `sips`（画像生成）。

**作業ディレクトリ:** worktree `/Users/hiranyu1/repo/mirai-gikai-localize-branding`（ブランチ `saitama/localize-branding`、ベース `poc/saitama-mirai-gikai`）。

**事前準備（最初に1回）:**
```bash
cd /Users/hiranyu1/repo/mirai-gikai-localize-branding
export PATH="/tmp/pnpm-shim:$PATH"   # corepack pnpm シム（無ければ作成）
corepack pnpm install --frozen-lockfile
```

**コミット規約:** 各タスク末尾でコミット。メッセージ末尾に
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` を付与。

---

## Task 1: カラートークンをさいたま市の緑へ

FORK要件4（primaryをそのまま使わない）。`bg-mirai-gradient` は全画面で使われるためグラデトークンも更新する。

**Files:**
- Modify: `web/src/app/globals.css:109-110,121-122`
- Modify: `web/src/app/layout.tsx:78,91`
- Modify: `web/src/app/api/og/report/route.tsx:175`
- Modify: `web/src/app/api/og/report/route.test.tsx:41`

- [ ] **Step 1: globals.css のカラー変数を変更**

`web/src/app/globals.css` を編集:
```
  --color-mirai-gradient-start: #64d8c6;   →   --color-mirai-gradient-start: #5cbf8e;
  --color-mirai-gradient-end: #bcecd3;      →   --color-mirai-gradient-end: #c3e8cf;
```
```
  --primary: #2aa693;          →   --primary: #2c8650;
  --primary-accent: #0f8472;   →   --primary-accent: #20603a;
```

- [ ] **Step 2: layout.tsx の teal を緑へ**

`web/src/app/layout.tsx`:
- L78 `themeColor: "#2aa693",` → `themeColor: "#2c8650",`
- L91 `<NextTopLoader showSpinner={false} color="#2aa693" />` → `color="#2c8650"`

- [ ] **Step 3: OG画像APIのアクセント色を変更**

`web/src/app/api/og/report/route.tsx:175` `color: "#0f8472",` → `color: "#20603a",`
`web/src/app/api/og/report/route.test.tsx:41` `element.props.style?.color === "#0f8472"` → `=== "#20603a"`

- [ ] **Step 4: 検証**

Run: `corepack pnpm --filter web test src/app/api/og/report/route.test.tsx`
Expected: PASS（色定数の更新に追随）

Run: `grep -rn -e "#2aa693" -e "#0f8472" web/src`
Expected: 出力なし（teal 残存なし）

- [ ] **Step 5: コミット**
```bash
git add web/src/app/globals.css web/src/app/layout.tsx web/src/app/api/og/report/
git commit -m "カラー: チームみらいtealをさいたま市の緑(#2c8650)へ"
```

---

## Task 2: サービス名・メタデータをさいたま市版へ

FORK要件1（サービス名「みらい議会＠地域名」）。

**Files:**
- Modify: `web/src/app/layout.tsx:22-25,30,37`

- [ ] **Step 1: タイトル・説明・名称を変更**

`web/src/app/layout.tsx`:
- L22 `const siteTitle = "みらい議会｜チームみらい";` → `const siteTitle = "みらい議会＠さいたま市";`
- L23-24 `const siteDescription =\n  "国会で今どんな法案が検討されているか、わかりやすく伝えるプラットフォーム";`
  → `const siteDescription =\n  "さいたま市議会で今どんな議案が審議されているか、わかりやすく伝えるプラットフォーム";`
- L25 `const siteName = "みらい議会";` → `const siteName = "みらい議会＠さいたま市";`
- L30 `alt: "みらい議会のOGPイメージ",` → `alt: "みらい議会＠さいたま市のOGPイメージ",`
- L37 `keywords: [siteName, "議案", "政治", "日本", "政策", "解説", "チームみらい"],`
  → `keywords: [siteName, "さいたま市", "さいたま市議会", "議案", "市政", "政策", "解説"],`

- [ ] **Step 2: 検証**

Run: `corepack pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 3: コミット**
```bash
git add web/src/app/layout.tsx
git commit -m "メタデータ: サービス名をみらい議会＠さいたま市へ"
```

---

## Task 3: ルート `kokkai` → `teireikai`

**Files:**
- Modify: `web/src/lib/routes.ts:41-42`
- Rename dir: `web/src/app/(main)/kokkai/` → `web/src/app/(main)/teireikai/`
- Modify: `web/src/features/bills/server/components/previous-session-section.tsx:32`
- Test: `web/src/lib/routes.test.ts`（page.tsx 同期テスト・コード変更不要、緑になることを確認）

- [ ] **Step 1: ルート関数を改名**

`web/src/lib/routes.ts`:
- L41 コメント `// ── 国会セッション ──...` → `// ── 定例会セッション ──...`
- L42 `kokkaiSessionBills: (slug: string) => \`/kokkai/${slug}/bills\` as const,`
  → `teireikaiSessionBills: (slug: string) => \`/teireikai/${slug}/bills\` as const,`

- [ ] **Step 2: ディレクトリをリネーム**
```bash
git mv "web/src/app/(main)/kokkai" "web/src/app/(main)/teireikai"
```

- [ ] **Step 3: 利用箇所を更新**

`web/src/features/bills/server/components/previous-session-section.tsx:32`
`const sessionBillsUrl = routes.kokkaiSessionBills(session.slug);`
→ `const sessionBillsUrl = routes.teireikaiSessionBills(session.slug);`

- [ ] **Step 4: 旧ルート文字列の残存確認**

Run: `grep -rn "kokkai" web/src`
Expected: 出力なし

- [ ] **Step 5: ルート同期テスト**

Run: `corepack pnpm --filter web test src/lib/routes.test.ts`
Expected: PASS（`/teireikai/[param]/bills` が page.tsx と一致）

- [ ] **Step 6: コミット**
```bash
git add -A
git commit -m "ルート: kokkai を teireikai(定例会)へリネーム"
```

---

## Task 4: ブランド画像をさいたま市民マークへ

FORK要件2・3（ロゴ・トップ画像・OGP・favicon/PWA）。市民マークはローカル `/tmp/shiminmaaku.jpg`（実体GIF 290x200）。
無ければ再取得: `curl -sL -o /tmp/shiminmaaku.jpg "https://www.city.saitama.lg.jp/006/012/001/007/p009133_d/fil/shiminmaaku.jpg"`

**Files:**
- Create: `web/public/img/saitama-civic-mark.png`
- Overwrite: `web/public/img/logo.svg`, `web/public/img/ogp-logo.png`, `web/public/ogp.jpg`,
  `web/public/img/hero_background.png`,
  `web/public/icons/pwa/icon_android_192.png`, `icon_android_512.png`, `icon_ios.png`

- [ ] **Step 1: 市民マークをPNG化して取り込む**
```bash
cd /Users/hiranyu1/repo/mirai-gikai-localize-branding
sips -s format png /tmp/shiminmaaku.jpg --out web/public/img/saitama-civic-mark.png
```

- [ ] **Step 2: logo.svg を市民マーク埋め込みSVGに差し替え**

logo.svg は header/footer/desktop-menu/mirai-stance-card の4箇所が `src="/img/logo.svg"` で参照。
ファイル自体を差し替えれば全箇所に反映される。
```bash
B64=$(base64 -i web/public/img/saitama-civic-mark.png | tr -d '\n')
printf '<svg xmlns="http://www.w3.org/2000/svg" width="290" height="200" viewBox="0 0 290 200"><image href="data:image/png;base64,%s" width="290" height="200"/></svg>' "$B64" > web/public/img/logo.svg
```

- [ ] **Step 3: OGPロゴ・OGP画像を生成（白背景パディング）**
```bash
# OGPロゴ（正方形寄り）
sips -p 200 290 --padColor FFFFFF web/public/img/saitama-civic-mark.png --out web/public/img/ogp-logo.png
# OGP画像 1200x630
sips -p 630 1200 --padColor FFFFFF web/public/img/saitama-civic-mark.png --out /tmp/ogp-pad.png
sips -s format jpeg /tmp/ogp-pad.png --out web/public/ogp.jpg
```

- [ ] **Step 4: ヒーロー画像を生成（淡緑背景に中央配置）**
```bash
sips -p 1000 1600 --padColor CFE8D8 web/public/img/saitama-civic-mark.png --out web/public/img/hero_background.png
```

- [ ] **Step 5: PWAアイコンを生成（正方形・白パディング）**
```bash
for sz in 192 512; do
  sips -p $sz $sz --padColor FFFFFF web/public/img/saitama-civic-mark.png --out web/public/icons/pwa/icon_android_${sz}.png
done
sips -p 192 192 --padColor FFFFFF web/public/img/saitama-civic-mark.png --out web/public/icons/pwa/icon_ios.png
```

- [ ] **Step 6: 生成物の寸法確認**

Run: `sips -g pixelWidth -g pixelHeight web/public/icons/pwa/icon_android_512.png web/public/ogp.jpg`
Expected: 512x512 / 1200x630

- [ ] **Step 7: コミット**
```bash
git add web/public/img web/public/ogp.jpg web/public/icons/pwa
git commit -m "ブランド: ロゴ・OGP・ヒーロー・PWAアイコンをさいたま市民マークへ"
```

---

## Task 5: ヒーロー・トップ系コピーの読み替え

**Files:**
- Modify: `web/src/components/top/hero.tsx:9,19,22`
- Modify: `web/src/components/top/about.tsx:29-34`
- Modify: `web/src/components/top/coming-soon-section.tsx:18,39,47-48`
- Modify: `web/src/components/layouts/desktop-menu/logo.tsx:44`
- Modify: `web/src/app/(main)/page.tsx:41,48,60`

- [ ] **Step 1: hero.tsx**
- L9 `alt="国会議事堂"` → `alt="さいたま市議会"`
- L19 `いま国会で議論されていること <br />` → `いまさいたま市議会で議論されていること <br />`
- L22 `<p className="mt-2 font-lexend text-xs">powered by Team Mirai & AI</p>` → `>powered by AI</p>`

- [ ] **Step 2: about.tsx**
- L29-32 `国会での議論を\n<br />\nできる限りわかりやすく` の `国会` → `さいたま市議会`（`さいたま市議会での議論を`）
- L34 全文を置換:
  `みらい議会は、国会で今どんな法案が検討されているか、わかりやすく伝えるプラットフォームです。国民の意見を政治に届けることを目指して、継続的にアップデートしていきます。`
  → `みらい議会＠さいたま市は、さいたま市議会で今どんな議案が審議されているか、わかりやすく伝えるプラットフォームです。市民の意見を市政に届けることを目指して、継続的にアップデートしていきます。`

- [ ] **Step 3: coming-soon-section.tsx**
- L18 `これから掲載される法案` → `これから掲載される議案`
- L39 コメント `{/* 国会議案情報へのリンク */}` → `{/* さいたま市公式サイトへのリンク */}`
- L41 `href="https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/menu.htm"` → `href="https://www.city.saitama.lg.jp/"`
- L47-48 `国会に提出されているすべての法案は{" "}` / `<span className="underline">国会議案情報へ</span>`
  → `さいたま市議会に提出されているすべての議案は{" "}` / `<span className="underline">さいたま市公式サイトへ</span>`

- [ ] **Step 4: logo.tsx**
- L44 `国会の議論をわかりやすく` → `さいたま市議会の議論をわかりやすく`

- [ ] **Step 5: page.tsx コメント**
- L41 `{/* 本日の国会セクション */}` → `{/* 本日のさいたま市議会セクション */}`
- L48 `{/* 注目の法案セクション */}` → `{/* 注目の議案セクション */}`
- L60 `{/* 前回の国会セクション（Archive） */}` → `{/* 前回の定例会セクション（Archive） */}`

- [ ] **Step 6: 検証**

Run: `corepack pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 7: コミット**
```bash
git add web/src/components/top web/src/components/layouts/desktop-menu "web/src/app/(main)/page.tsx"
git commit -m "コピー: トップ・ヒーローの国会用語をさいたま市議会へ"
```

---

## Task 6: フッターに免責文言・本家リンク、チームみらい宣伝リンク除去

FORK要件5（免責文言）＋推奨（本家リンク）。チームみらい宣伝リンク除去。

**Files:**
- Modify: `web/src/components/layouts/footer/footer.config.ts:15-37`
- Modify: `web/src/components/layouts/footer/footer.tsx`（免責文言の追加）

- [ ] **Step 1: footer.config.ts の primaryLinks からチームみらい宣伝を除去**

`primaryLinks` 配列から「チームみらいについて」(`EXTERNAL_LINKS.TEAM_MIRAI_ABOUT`) と
「寄附で応援する」(`EXTERNAL_LINKS.DONATION`) のオブジェクトを削除。残すのは「TOP」と「みらい議会とは」。
未使用になる `EXTERNAL_LINKS` のキーは import が残ってもよい（他で参照される可能性のため変更しない）。

結果:
```ts
export const primaryLinks: FooterLink[] = [
  {
    label: "TOP",
    href: routes.home(),
  },
  {
    label: "みらい議会とは",
    href: EXTERNAL_LINKS.ABOUT_NOTE,
    external: true,
  },
];
```

- [ ] **Step 2: footer.tsx に免責文言＋本家リンクを追加**

`FooterCopyright` の直前に免責ブロックを描画する。`<Link>` は既に import 済み。
`FooterCopyright` コンポーネントの呼び出し直前（`<FooterPolicies />` と `<FooterCopyright />` の間）に
`<FooterDisclaimer />` を追加し、コンポーネントを新設:
```tsx
function FooterDisclaimer() {
  return (
    <div className="mb-5 text-center text-[12px] leading-relaxed text-slate-800">
      <p>これは政党チームみらいが運営しているものではありません</p>
      <Link
        href={"https://gikai.team-mir.ai/" as Route}
        target="_blank"
        rel="noreferrer"
        className="underline transition-colors hover:text-slate-900"
      >
        本家「みらい議会」はこちら
      </Link>
    </div>
  );
}
```
`Footer()` 内の JSX に `<FooterDisclaimer />` を `<FooterPolicies />` の後に挿入。

- [ ] **Step 3: 検証**

Run: `corepack pnpm --filter web typecheck`
Expected: PASS

Run: `corepack pnpm --filter web lint`
Expected: PASS（未使用 import があれば除去して再実行）

- [ ] **Step 4: コミット**
```bash
git add web/src/components/layouts/footer
git commit -m "フッター: 免責文言と本家リンクを追加・チームみらい宣伝リンクを除去"
```

---

## Task 7: トップの TeamMirai セクションを除去

チームみらい宣伝（安野貴博 参議院議員…）。免責文言と矛盾するため除去。

**Files:**
- Modify: `web/src/app/(main)/page.tsx:5,77-78`
- Delete: `web/src/components/top/team-mirai.tsx`

- [ ] **Step 1: page.tsx から TeamMirai を除去**

`web/src/app/(main)/page.tsx`:
- L5 `import { TeamMirai } from "@/components/top/team-mirai";` を削除
- L77-78 のコメント `{/* チームみらいについて セクション */}` と `<TeamMirai />` を削除

- [ ] **Step 2: 不要コンポーネントを削除**
```bash
git rm web/src/components/top/team-mirai.tsx
```

- [ ] **Step 3: 残参照の確認**

Run: `grep -rn "team-mirai\b\|TeamMirai" web/src --include="*.tsx" --include="*.ts" | grep -v "team-mirai-typography\|SOCIAL\|TEAM_MIRAI_ABOUT"`
Expected: 出力なし（TeamMirai の参照が消えている）

Run: `corepack pnpm --filter web typecheck`
Expected: PASS

- [ ] **Step 4: コミット**
```bash
git add -A
git commit -m "トップ: チームみらい紹介セクションを除去"
```

---

## Task 8: 議案・インタビュー・チャットのコピー読み替え

**Files:**
- Modify: `web/src/features/bills/server/components/featured-bill-section.tsx:24`
- Modify: `web/src/features/bills/server/components/previous-session-section.tsx:51`
- Modify: `web/src/features/bills/client/components/bill-detail/bill-disclaimer.tsx:12`
- Modify: `web/src/features/bills/client/components/bill-list/compact-bill-card.tsx:15`
- Modify: `web/src/features/bills/client/components/share/bill-share-modal.tsx:106`
- Modify: `web/src/features/diet-sessions/client/components/diet-session-bill-list.tsx:31,38,46,49,55,58,65`
- Modify: `web/src/features/diet-sessions/client/components/current-diet-session.tsx:18,40`
- Modify: `web/src/features/chat/client/components/chat-window.tsx:88,103`
- Modify: `web/src/features/interview-config/client/components/interview-lp-page.tsx:46,152,162`
- Modify: `web/src/features/interview-config/server/components/interview-disclosure-page.tsx:78`

- [ ] **Step 1: featured / previous-session 見出し**
- featured-bill-section.tsx:24 `国会に提出された注目法案` → `さいたま市議会に提出された注目議案`
- previous-session-section.tsx:51 `過去の国会に提出された法案` → `過去の定例会に提出された議案`

- [ ] **Step 2: bill-disclaimer.tsx の出典説明（チームみらい・閣法を除去）**

L12-14 を以下に置換（`ManualRuby`（閣法ルビ）は不要になるので該当 JSX を削除し、import も削除）:
```tsx
        <p className="text-xs leading-relaxed text-mirai-text-note">
          掲載されている議案情報は、さいたま市議会に提出された議案などの公開情報を基に、AIを活用しながら背景情報を整理したものです。
        </p>
```
併せて L3 `import { ManualRuby } from "@/lib/rubyful/manual-ruby";` を削除（他で未使用なら）。

- [ ] **Step 3: compact-bill-card.tsx コメント**
- L15 `* 過去国会セクションや過去国会議案一覧ページで使用` → `* 過去の定例会セクションや過去の議案一覧ページで使用`

- [ ] **Step 4: bill-share-modal.tsx**
- L106 `シェアして国会の議論をオープンに` → `シェアしてさいたま市議会の議論をオープンに`

- [ ] **Step 5: diet-session-bill-list.tsx（表示文字のみ・識別子据え置き）**
- L31 `過去の国会に提出された法案` → `過去の定例会に提出された議案`
- L38 `{startDate.getFullYear()}年 {session.name}の提出法案` → `…の提出議案`
- L46 コメント `{/* フィルター付き法案リスト */}` → `{/* フィルター付き議案リスト */}`
- L49 `この会期の法案はまだありません` → `この会期の議案はまだありません`
- L55 コメント `{/* 衆議院リンク */}` → `{/* 議案情報リンク */}`
- L58 `{startDate.getFullYear()}年{session.name}に提出された全ての法案は` → `…全ての議案は`
- L65 `国会議案情報へ` → `さいたま市議会の議案情報へ`

- [ ] **Step 6: current-diet-session.tsx**
- L18 コメント内 `国会閉会中` → `閉会中`
- L40 `{session == null ? "国会閉会中" : "国会会期中"}` → `{session == null ? "閉会中" : "会期中"}`

- [ ] **Step 7: chat-window.tsx**
- L88 `国会や法案について、気になることをAIに質問してください。` → `さいたま市議会や議案について、気になることをAIに質問してください。`
- L103 `"国会って何をするところ？",` → `"さいたま市議会って何をするところ？",`

- [ ] **Step 8: interview-lp-page.tsx**
- L46 `text: "ご意見はチームみらいを通じて国会に届けられる可能性があります",` → `text: "ご意見はさいたま市議会に届けられる可能性があります",`
- L152 `国会で検討されている` → `さいたま市議会で検討されている`
- L162 `いただいたご意見は、政策研究や国会での審議に活用し、みらい議会上に公開される可能性があります。` → `いただいたご意見は、政策研究やさいたま市議会での審議に活用し、みらい議会＠さいたま市上に公開される可能性があります。`

- [ ] **Step 9: interview-disclosure-page.tsx**
- L78 `…統計的な集計結果、または個人を特定できない範囲に匿名化した上で、国会答弁等において引用・活用される場合があります。`
  → `…匿名化した上で、さいたま市議会での審議等において引用・活用される場合があります。`

- [ ] **Step 10: 検証**

Run: `corepack pnpm --filter web typecheck`
Expected: PASS

Run: `corepack pnpm --filter web test src/features/bills src/features/diet-sessions`
Expected: PASS（表示文言に依存する既存テストがあれば追随更新。`衆議院`/`参議院` ラベル・enum のテストは task3 送りのため変更しない）

- [ ] **Step 11: コミット**
```bash
git add web/src/features
git commit -m "コピー: 議案・インタビュー・チャットの国会用語をさいたま市議会へ"
```

---

## Task 9: 利用規約のコピー読み替え

**Files:**
- Modify: `web/src/app/(main)/terms/page.tsx:71`

- [ ] **Step 1: terms/page.tsx**
- L71 `"目的外利用：「みらい議会」の趣旨（国会提出法案等の関連テーマ）を著しく逸脱した応答を生成させる行為。",`
  → `"目的外利用：「みらい議会＠さいたま市」の趣旨（さいたま市議会提出議案等の関連テーマ）を著しく逸脱した応答を生成させる行為。",`

- [ ] **Step 2: コミット**
```bash
git add "web/src/app/(main)/terms/page.tsx"
git commit -m "コピー: 利用規約の国会用語をさいたま市議会へ"
```

---

## Task 10: 最終検証

- [ ] **Step 1: 残存用語の確認（task3送り以外が残っていないこと）**
```bash
grep -rn -e "国会" -e "kokkai" web/src --include="*.tsx" --include="*.ts" | grep -v -e "/lib/prompt/" -e ".test." -e "mock-data"
```
Expected: 出力なし（AIプロンプト `lib/prompt/` とテスト/モックは task3 送りのため許容）。
`法案` は残ってよい箇所（引用・固有名）がないか目視。`衆議院`/`参議院` の進捗バー・enum 表示は task3 送りで残置（既知）。

- [ ] **Step 2: ローカル品質ゲート**
```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
```
Expected: すべて exit 0。落ちたら原因修正して再実行。

- [ ] **Step 3: 画面確認（dev起動）**

Supabase は 2.105.0 で起動済み前提。web dev を root .env を読ませて起動:
```bash
cd web && set -a && . ../.env && set +a && corepack pnpm dev
```
ブラウザで確認:
- `http://localhost:3000/` トップ: ロゴ=市民マーク、配色=緑、ヒーロー文言・aboutが市議会版、TeamMiraiセクション無し、フッターに免責＋本家リンク
- `http://localhost:3000/teireikai/r8-june/bills` 定例会一覧（旧 /kokkai は 404）
- `http://localhost:3000/bills/<billId>` 議案詳細: 「論点整理」、出典説明にチームみらい無し
- `http://localhost:3000/bills/<billId>/interview` インタビューLP: 「さいたま市議会に届けられる可能性」

> **PRへのスクリーンショット添付は不要**（ユーザー自身がブラウザで最終確認するため `/pr-screenshot` は実行しない）。

- [ ] **Step 4: セルフレビュー → PR**

CLAUDE.md 手順:
1. `/simplify` 実行（重複・可読性・効率）
2. `/review` 実行（Codex / test-guidelines / code-quality）
3. 指摘対応後、`poc/saitama-mirai-gikai` をベースに push & `gh pr create`

---

## 完了条件チェックリスト
- [ ] カラー（primary/accent/gradient/themeColor）が #2c8650 系
- [ ] サービス名「みらい議会＠さいたま市」
- [ ] ロゴ・ヒーロー・OGP・PWAアイコンが市民マーク
- [ ] ルート `/teireikai/...` で到達（`kokkai` 残存なし）
- [ ] フッターに免責文言＋本家リンク、チームみらい宣伝リンク除去
- [ ] TeamMirai セクション除去
- [ ] 表示コピーが市議会版（国会/法案→さいたま市議会/議案、コード識別子は据え置き）
- [ ] lint / typecheck / build / test すべて通過

## task3 へ送る既知の未整合
- 議案進捗バーの「衆議院審議/参議院審議」ラベル・段階構造
- `originating_house` の HR/HC=衆/参 ラベル
- AIチャットのチームみらい党説明プロンプト（`web/src/lib/prompt/source-code/templates/shared-sections.ts`）
- コード識別子（`diet_sessions`/`diet-sessions`/`diet_session_id`/`originating_house`）
- 市民マークの本番利用申請（PoCローカル限定）
