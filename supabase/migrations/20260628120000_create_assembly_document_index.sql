-- 議会資料メタデータインデックス: DiscussCabinet のフォルダ/文書メタを軽量に取り込み、
-- MCP/AI からの検索性を上げる。PDF本文は保存しない（メタデータのみ）。
-- 設計: docs/superpowers/specs/2026-06-28-assembly-document-index-design.md

CREATE TABLE assembly_folders (
  folder_id        BIGINT PRIMARY KEY,                         -- DiscussCabinet のフォルダID
  cabinet_id       BIGINT NOT NULL,                            -- 1=本会議 / 2=委員会
  parent_folder_id BIGINT,                                     -- ルート取込点は NULL
  name             TEXT NOT NULL,
  path             TEXT NOT NULL,                              -- 例: /本会議/令和８年/６月定例会/審議結果/
  imported_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE assembly_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    BIGINT NOT NULL,
  folder_id     BIGINT NOT NULL,                              -- assembly_folders.folder_id（FK制約は張らない）
  docid         BIGINT NOT NULL,
  title         TEXT NOT NULL,
  doc_date      DATE,                                         -- 正規化済み。失敗時 NULL
  raw_date      TEXT,                                         -- 元の表示文字列
  folder_path   TEXT NOT NULL,                               -- 文書カードに直接出せるよう非正規化
  session_label TEXT,                                         -- 例: 令和8年6月定例会（パスから導出）
  imported_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (cabinet_id, docid)
);

CREATE INDEX assembly_documents_session_idx ON assembly_documents (session_label);
CREATE INDEX assembly_documents_cabinet_idx ON assembly_documents (cabinet_id);

-- RLS 有効・ポリシー無し（デフォルト全拒否）。アクセスは createAdminClient 経由のみ。
ALTER TABLE assembly_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_documents ENABLE ROW LEVEL SECURITY;
