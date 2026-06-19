/** 分を「N時間M分」形式に整形する。 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/** 分を時間（小数第1位）に変換する。 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}
