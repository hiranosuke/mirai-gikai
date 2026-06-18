import "server-only";

import type { DiscussionPoints } from "../../shared/types";
import { findDiscussionPointsByBillId } from "../repositories/discussion-points-repository";

export async function getDiscussionPointsByBillId(
  billId: string
): Promise<DiscussionPoints | null> {
  return findDiscussionPointsByBillId(billId);
}
