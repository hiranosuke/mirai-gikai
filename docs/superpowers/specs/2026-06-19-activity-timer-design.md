# 設計: 編集ページの作業時間タイマー実測（さいたまPoC 増分3-C）

作成: 2026-06-19 / ブランチ: `saitama/activity-timer`（base: `poc/saitama-mirai-gikai`）

## 0. 位置づけ

増分3-B（PR #15, merged）で `ops_activity_log`（作業ログ）テーブル・手入力フォーム・議案別一覧・Grafana の土台を入れた。3-B にあった「参考シグナル（`created_at→updated_at` の経過表示）」は、経過時間が作業時間と誤読されるため削除済み。

本増分3-C は、その代替として **議案関連の編集ページを開いている実時間を計測し、保存成功時にダイアログで確認して `ops_activity_log` に登録する半自動方式** を追加する。手入力（3-B）と並ぶ「もう一つの記録経路」であり、DB・Grafana は 3-B のものをそのまま使う（**スキーマ変更なし・Grafana変更なし**）。

## 1. 計測方式（アイドル処理）

- フォームのマウント時から **アクティブ時間（ミリ秒）を累積** する。
- `document.visibilitychange` を監視し、**タブが非表示（`document.hidden`）の間は計測を一時停止**、再表示で再開する。
- 同タブでの放置（考え事・離席）は計測に含まれる。これはダイアログで人が手修正する前提とする（完全な精度は狙わない）。
- 「記録する」を確定したら **計測ベースラインをリセット** し、次の保存はそこからの差分を測る。「記録しない（スキップ）」では累積を継続する（時間を失わない）。

## 2. 計測対象（保存ボタンが初期種別を宣言）

種別が明確に対応する2つの保存ボタンのみを対象とする。`bill_id` はいずれも URL params から確定する。

| フォーム（ファイル） | ボタン | 初期 `activity_type` |
|---|---|---|
| `admin/src/features/bills-edit/client/components/bill-contents-edit-form.tsx` | 保存 | `content` |
| `admin/src/features/interview-config/client/components/interview-config-form.tsx` | 保存 | `interview_config` |

基本情報編集・タグ・新規作成は4区分にきれいに対応しないため対象外（YAGNI、効果を見て将来拡張）。

## 3. 保存時ダイアログ（保存成功後に表示）

```
┌─────────────────────────────────────────┐
│ 作業ログに記録しますか？                  │
│                                           │
│ 今回の編集の計測時間: 約 23 分            │
│  作業時間(分) [ 23 ]   種別 [コンテンツ作成▼]│
│  メモ(任意)   [____________________]      │
│                                           │
│            [ 記録しない ]  [ 記録する ]   │
└─────────────────────────────────────────┘
```

- **作業時間(分)**: 編集可。既定 = `max(1, Math.round(activeMs / 60000))`（`minutes > 0` 制約のため最低1分）。
- **種別**: 既存の Select で変更可（初期値はボタン宣言の種別）。
- **議案**: params から確定済みのため UI には出さず、`bill_id` として送信する。
- **メモ**: 任意。
- **「記録する」**: 既存の Server Action `createOpsActivityLog`（3-B、`"use server"`）を**再利用**して登録 → 成功トースト → タイマーリセット → ダイアログを閉じる。失敗時はエラートーストのみ表示し、リセットせず再試行可能。
- **「記録しない」**: ダイアログを閉じる（累積は継続）。
- `occurred_on` は保存日（当日）を送る。

## 4. アーキテクチャ（`ops-activity-log` feature の `client/` に集約）

他feature（`bills-edit` / `interview-config`）から使う共有部品として、作業ログ機能の中心である `ops-activity-log` feature 配下に置く。

```
admin/src/features/ops-activity-log/client/
├── hooks/
│   ├── use-activity-timer.ts        # visibility 対応の累積タイマー。getElapsedMs()/reset()
│   └── use-activity-log-prompt.ts   # timer + dialog 状態を束ね、promptAfterSave() と dialog を返す
├── components/
│   └── activity-log-prompt-dialog.tsx  # §3 のダイアログ
└── utils/
    ├── compute-elapsed-minutes.ts   # activeMs → 表示用「分」（丸め・最低1分）。純粋関数
    └── sum-active-ms.ts             # アクティブ区間配列の合計ms。純粋関数（タイマーから利用）
```

`use-activity-timer.ts` は区間の開始/終了を記録し、合計の算出を純粋関数 `sumActiveMs` に委譲する（副作用＝`Date.now()`/イベント購読のみ hook に残す）。

### 公開インターフェース

```ts
// use-activity-log-prompt.ts
export function useActivityLogPrompt(params: {
  billId: string;
  defaultActivityType: OpsActivityType;
}): {
  promptAfterSave: () => void; // 保存成功後に呼ぶ。経過を確定しダイアログを開く
  dialog: React.ReactNode;     // 各フォームの JSX 末尾に描画する
};
```

### フォーム側の改修（最小）

```ts
const { promptAfterSave, dialog } = useActivityLogPrompt({
  billId,
  defaultActivityType: "content", // interview-config-form では "interview_config"
});
// 保存アクション成功後の分岐で: promptAfterSave();
// return(...) の末尾に: {dialog}
```

既存の保存ロジック・トーストはそのまま。タイマーはフォームのマウント中だけ動く。

## 5. エラーハンドリング

- `createOpsActivityLog` 失敗時はエラートースト表示、ダイアログは開いたまま・タイマー非リセットで再試行可能。
- 分の入力が 1 未満/非整数のときは「記録する」を無効化 or バリデーションエラートースト（送信前にクライアントで弾く）。`createOpsActivityLog` 内の zod 検証も二重の保険になる。

## 6. テスト方針

- **純粋関数 `computeElapsedMinutes(activeMs)`**: 丸め・最低1分・0msの扱いに `*.test.ts`（必須）。
- **タイマーの累積ロジック**: 「アクティブ区間（開始/終了タイムスタンプの配列）の合計ミリ秒」を計算する純粋関数 `sumActiveMs(segments)` に切り出してテストする。`visibilitychange`/`Date.now()` の副作用は hook 側に薄く残す。
- 登録経路は 3-B の `createOpsActivityLog`（テスト済み）を再利用するため新規の統合テストは不要。
- DB function の追加なし。

## 7. スコープ外（YAGNI）

- 基本情報編集・タグ・新規作成ボタンの計測（効果を見て将来）。
- 完全なアイドル検出（マウス/キー無操作タイマー）。タブ非表示停止＋手修正で十分とする。
- 複数タブ・別デバイス間の合算。
- DB/Grafana の変更（3-B のものを流用）。

## 8. 検証（受け入れ条件）

- コンテンツ編集ページで編集→保存すると、計測分入りのダイアログが出る。種別は「コンテンツ作成」が初期選択。
- インタビュー設定フォームの保存で、種別「インタビュー設定」初期のダイアログが出る。
- 「記録する」で `ops_activity_log` に登録され、`/ops-activity-log` 一覧と Grafana に反映される。続けて保存するとタイマーがリセットされ差分が測られる。「記録しない」では登録されない。
- タブを別タブに切り替えている間は計測が増えない。
- `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm test` 全通過。
