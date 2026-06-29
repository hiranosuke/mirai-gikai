/**
 * DiscussCabinet の表示日付（YYYY/MM/DD、既に西暦）を date 文字列 YYYY-MM-DD に変換する。
 * 形式が一致しない場合は null（DB の doc_date は NULL 許容）。
 */
export function parseDocDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // 実在しない日付（月ごとの日数・閏年）を弾く。Date.UTC で組み立てて各要素が
  // round-trip するか確認する（例: 2026/02/31, 非閏年の 2025/02/29 → null）。
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}
