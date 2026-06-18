"use server";

import {
  invalidateWebCache,
  WEB_CACHE_TAGS,
} from "@/lib/utils/cache-invalidation";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import type { DiscussionPointsInput } from "../../shared/types";
import { updateDiscussionPoints as updateDiscussionPointsRepo } from "../repositories/discussion-points-repository";

export async function updateDiscussionPoints(
  id: string,
  data: DiscussionPointsInput
) {
  try {
    await updateDiscussionPointsRepo(id, data);

    invalidateWebCache([WEB_CACHE_TAGS.BILLS]);
    return { success: true };
  } catch (error) {
    console.error("Error in updateDiscussionPoints:", error);
    return {
      success: false,
      error: getErrorMessage(error, "予期しないエラーが発生しました"),
    };
  }
}
