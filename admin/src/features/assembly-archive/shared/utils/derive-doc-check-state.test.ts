import { describe, expect, it } from "vitest";
import { deriveDocCheckState } from "./derive-doc-check-state";

describe("deriveDocCheckState", () => {
  it("1件も選択されていなければ false", () => {
    expect(deriveDocCheckState(3, 0)).toBe(false);
  });

  it("一部だけ選択されていれば indeterminate", () => {
    expect(deriveDocCheckState(3, 1)).toBe("indeterminate");
    expect(deriveDocCheckState(3, 2)).toBe("indeterminate");
  });

  it("全件選択されていれば true", () => {
    expect(deriveDocCheckState(3, 3)).toBe(true);
  });

  it("ファイルが0件なら false", () => {
    expect(deriveDocCheckState(0, 0)).toBe(false);
  });
});
