const FULLWIDTH_DIGITS = "０１２３４５６７８９";

function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) =>
    String(FULLWIDTH_DIGITS.indexOf(ch))
  );
}

/**
 * フォルダパスから会期ラベル（例: 令和8年6月定例会）を導出する。
 * 年セグメント（令和N年 / 平成N年 / 令和元年）と会期セグメント（N月定例会 / N月臨時会）を
 * パス中から探して連結する。本会議・委員会いずれの入れ子構造でも動く。
 */
export function deriveSessionLabel(path: string): string | null {
  const segments = path
    .split("/")
    .map((s) => toHalfWidthDigits(s.trim()))
    .filter((s) => s.length > 0);

  const year = segments.find((s) => /^(令和|平成)(元|\d+)年$/.test(s));
  const session = segments.find((s) => /^\d+月(定例会|臨時会)$/.test(s));

  if (!year || !session) return null;
  return `${year}${session}`;
}
