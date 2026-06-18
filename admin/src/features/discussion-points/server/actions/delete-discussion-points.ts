"use server";

import {
  invalidateWebCache,
  WEB_CACHE_TAGS,
} from "@/lib/utils/cache-invalidation";
import { getErrorMessage } from "@/lib/utils/get-error-message";
import { deleteDiscussionPoints as deleteDiscussionPointsRepo } from "../repositories/discussion-points-repository";

export async function deleteDiscussionPoints(id: string) {
  try {
    await deleteDiscussionPointsRepo(id);

    invalidateWebCache([WEB_CACHE_TAGS.BILLS]);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteDiscussionPoints:", error);
    return {
      success: false,
      error: getErrorMessage(error, "予期しないエラーが発生しました"),
    };
  }
}
