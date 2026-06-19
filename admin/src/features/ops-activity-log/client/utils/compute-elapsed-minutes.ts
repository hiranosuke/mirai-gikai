/** アクティブ時間(ミリ秒)を表示用の「分」に変換する。`minutes > 0` 制約のため最低1分。 */
export function computeElapsedMinutes(activeMs: number): number {
  return Math.max(1, Math.round(activeMs / 60_000));
}
