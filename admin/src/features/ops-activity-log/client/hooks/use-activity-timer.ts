"use client";

import { useCallback, useEffect, useRef } from "react";
import { type ActiveSegment, sumActiveMs } from "../utils/sum-active-ms";

/**
 * マウント中のアクティブ時間を累積する。タブ非表示（document.hidden）の間は
 * 計測を一時停止する。getElapsedMs で現在までの累積ミリ秒、reset で計測をやり直す。
 */
export function useActivityTimer(): {
  getElapsedMs: () => number;
  reset: () => void;
} {
  const segmentsRef = useRef<ActiveSegment[]>([]);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // マウント時、表示中なら計測開始
    startRef.current = document.hidden ? null : Date.now();

    const handleVisibility = () => {
      if (document.hidden) {
        if (startRef.current !== null) {
          segmentsRef.current.push({
            start: startRef.current,
            end: Date.now(),
          });
          startRef.current = null;
        }
      } else {
        startRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const getElapsedMs = useCallback(() => {
    const closed = sumActiveMs(segmentsRef.current);
    const open = startRef.current !== null ? Date.now() - startRef.current : 0;
    return closed + open;
  }, []);

  const reset = useCallback(() => {
    segmentsRef.current = [];
    startRef.current = document.hidden ? null : Date.now();
  }, []);

  return { getElapsedMs, reset };
}
