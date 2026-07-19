import type { Cabinet } from "./types";

export const DISCUSS_CABINET_BASE_URL =
  "https://www.discusscabinet.net/saitama";

// ルートキャビネットは安定IDのため固定値で持つ（本会議=1 / 委員会=2）。
// マニュアルキャビネット(721)は議会資料ではないため対象外。
export const ROOT_CABINETS: Cabinet[] = [
  { cabinetId: 1, name: "本会議" },
  { cabinetId: 2, name: "委員会" },
];

// サブツリー取り込みの暴走防止ガードと負荷配慮の待機時間。
export const MAX_CRAWL_DEPTH = 6;
export const MAX_CRAWL_DOCUMENTS = 5000;
export const CRAWL_DELAY_MS = 200;
