/**
 * Format a roleDescription string into an array of lines.
 * Splits by newlines, trims whitespace, and removes empty lines.
 * When there are multiple lines, ensures each starts with "・".
 * A single line is returned as-is without bullet prefix.
 */
export function formatRoleDescriptionLines(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return lines;
  }

  return lines.map((line) => (line.startsWith("・") ? line : `・${line}`));
}

/**
 * 回答日時を Asia/Tokyo 固定で "YYYY.M.D HH:mm" に整形する。
 * サーバー/クライアントのローカルタイムゾーンに依存せず、常に日本時間で表示する。
 * iso が null/不正な場合は空文字を返す。
 */
export function formatAnsweredAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // hour は 24:00 表記になりうるため 00 に正規化する。
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}.${Number(get("month"))}.${Number(get("day"))} ${hour}:${get("minute")}`;
}

export interface ParsedOpinion {
  title: string;
  content: string;
  source_message_id?: string | null;
}

/**
 * Parse opinions from an unknown value (typically JSON from DB).
 * Returns a typed array of {title, content, source_message_id} objects,
 * or an empty array if the input is not an array.
 */
export function parseOpinions(opinions: unknown): ParsedOpinion[] {
  if (!Array.isArray(opinions)) {
    return [];
  }
  return opinions as ParsedOpinion[];
}
