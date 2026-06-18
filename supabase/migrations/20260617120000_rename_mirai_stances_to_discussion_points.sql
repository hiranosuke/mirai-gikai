-- mirai_stances を中立な「論点整理」テーブルへ転用する。
-- さいたま市議会版では特定主体（政党）が賛否を表明する前提を廃止し、
-- 賛成の論拠／反対の論拠を中立に併記する構造へ変更する。
-- stance_type_enum は interview_report.stance 等で使うため温存する。

alter table mirai_stances rename to discussion_points;

-- 制約名も旧テーブル名の痕跡を残さないようリネーム
alter table discussion_points
  rename constraint mirai_stances_pkey to discussion_points_pkey;
alter table discussion_points
  rename constraint mirai_stances_bill_id_key to discussion_points_bill_id_key;
alter table discussion_points
  rename constraint mirai_stances_bill_id_fkey to discussion_points_bill_id_fkey;

-- インデックス: bill_id はリネーム、type 用は廃止
alter index idx_mirai_stances_bill_id rename to idx_discussion_points_bill_id;
drop index if exists idx_mirai_stances_type;

-- updated_at トリガをリネーム
alter trigger update_mirai_stances_updated_at on discussion_points
  rename to update_discussion_points_updated_at;

-- 党の賛否判定カラム・コメントを廃止し、賛成論拠／反対論拠を追加
alter table discussion_points drop column type;
alter table discussion_points drop column comment;
alter table discussion_points add column pro_points text;
alter table discussion_points add column con_points text;

-- 主体の賛否表明を前提としたコメントを中立な説明へ置換
comment on table discussion_points is '議案ごとの論点整理（賛成の論拠／反対の論拠を中立に併記）';

-- RLS（ポリシーは定義しない＝デフォルト全拒否。アクセスは createAdminClient 経由）
alter table discussion_points enable row level security;
