/**
 * DiscussCabinet の表示日付（YYYY/MM/DD、既に西暦）を date 文字列 YYYY-MM-DD に変換する。
 * 形式が一致しない場合は null（DB の doc_date は NULL 許容）。
 */
export function parseDocDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
