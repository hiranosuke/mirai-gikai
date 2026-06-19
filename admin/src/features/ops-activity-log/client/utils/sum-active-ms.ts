export type ActiveSegment = { start: number; end: number };

/** アクティブ区間（ミリ秒タイムスタンプ）の合計ミリ秒。異常区間は0として扱う。 */
export function sumActiveMs(segments: ActiveSegment[]): number {
  return segments.reduce(
    (total, segment) => total + Math.max(0, segment.end - segment.start),
    0
  );
}
