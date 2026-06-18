-- 運用労力ログ: 議案を公開状態にするまでの作業時間を手入力で記録する。
-- さいたまPoC 増分3-B。設計: docs/superpowers/specs/2026-06-18-ops-activity-log-design.md
-- minutes は手入力の確定値のみ保存（自動推定値は保存せず、loader で参考表示するだけ）。

CREATE TYPE ops_activity_type_enum AS ENUM (
  'selection',         -- 議案選定
  'content',           -- コンテンツ作成（簡易/詳細）
  'interview_config',  -- インタビュー設定
  'review',            -- レビュー・公開
  'other'              -- 上記以外（告知・振り返り等）
);

CREATE TABLE ops_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id       UUID REFERENCES bills(id) ON DELETE SET NULL,  -- 任意（サイクル全体作業は NULL）
  activity_type ops_activity_type_enum NOT NULL,
  minutes       INTEGER NOT NULL CHECK (minutes > 0),          -- 手入力の確定値（分）
  note          TEXT,                                          -- ボトルネック等の任意メモ
  occurred_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ops_activity_log_bill_id_idx     ON ops_activity_log (bill_id);
CREATE INDEX ops_activity_log_occurred_on_idx ON ops_activity_log (occurred_on);

-- RLS 有効・ポリシー無し（デフォルト全拒否）。アクセスは createAdminClient 経由のみ。
ALTER TABLE ops_activity_log ENABLE ROW LEVEL SECURITY;

-- createAdminClient（service_role）が全操作できるよう明示的に権限付与する。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_activity_log TO service_role;
