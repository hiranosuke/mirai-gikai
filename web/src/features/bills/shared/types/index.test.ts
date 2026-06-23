import { describe, expect, it } from "vitest";

import { getBillStatusLabel } from "./index";

describe("getBillStatusLabel", () => {
  it("returns '準備中' for preparing", () => {
    expect(getBillStatusLabel("preparing")).toBe("準備中");
  });

  it("returns '提出済み' for introduced", () => {
    expect(getBillStatusLabel("introduced")).toBe("提出済み");
  });

  it("returns '成立' for enacted", () => {
    expect(getBillStatusLabel("enacted")).toBe("成立");
  });

  it("returns '否決' for rejected", () => {
    expect(getBillStatusLabel("rejected")).toBe("否決");
  });

  // さいたま市議会は一院制のため、発議院(HR/HC)に依存せず市議会用語を返す
  it("returns '委員会審査中' for in_originating_house", () => {
    expect(getBillStatusLabel("in_originating_house")).toBe("委員会審査中");
  });

  it("returns '本会議審議中' for in_receiving_house", () => {
    expect(getBillStatusLabel("in_receiving_house")).toBe("本会議審議中");
  });

  it("returns the status string as-is for unknown status", () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用に未知のステータスを渡す
    expect(getBillStatusLabel("unknown_status" as any)).toBe("unknown_status");
  });
});
