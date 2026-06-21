import "server-only";

import { calculateSetDiff } from "@/lib/utils/calculate-set-diff";
import type { BillDraftInput } from "../../shared/types/bill-draft";
import {
  createBillRecord,
  createBillsTags,
  deleteBillsTags,
  findBillsTagsByBillId,
  updateBillRecord,
  upsertBillContent,
} from "../repositories/bill-edit-repository";

export type UpsertBillDraftResult = {
  billId: string;
  created: boolean;
};

export async function upsertBillFromDraft(
  input: BillDraftInput
): Promise<UpsertBillDraftResult> {
  const { billId, contents, tagIds, submitted_date, ...metaFields } = input;

  // submitted_date は「未指定（undefined）= 変更しない」と
  // 「空文字 = クリア」を区別する。空文字 → null、日付 → ISO。
  const submittedDatePatch =
    submitted_date === undefined
      ? {}
      : {
          submitted_date: submitted_date
            ? `${submitted_date}T00:00:00+09:00`
            : null,
        };

  let resolvedBillId: string;
  let created: boolean;

  if (billId) {
    await updateBillRecord(billId, {
      ...metaFields,
      ...submittedDatePatch,
      updated_at: new Date().toISOString(),
    });
    resolvedBillId = billId;
    created = false;
  } else {
    const inserted = await createBillRecord({
      ...metaFields,
      ...submittedDatePatch,
    });
    resolvedBillId = inserted.id;
    created = true;
  }

  await Promise.all([
    contents
      ? Promise.all(
          (["normal", "hard"] as const).map(async (difficulty) => {
            const data = contents[difficulty];
            if (!data) return;
            const { title = "", summary = "", content = "" } = data;
            if (!title && !summary && !content) return;
            await upsertBillContent({
              billId: resolvedBillId,
              difficultyLevel: difficulty,
              title,
              summary,
              content,
            });
          })
        )
      : Promise.resolve(),
    tagIds !== undefined
      ? findBillsTagsByBillId(resolvedBillId).then(async (existingTagIds) => {
          const { toAdd, toDelete } = calculateSetDiff(existingTagIds, tagIds);
          await Promise.all([
            toDelete.length > 0
              ? deleteBillsTags(resolvedBillId, toDelete)
              : Promise.resolve(),
            toAdd.length > 0
              ? createBillsTags(resolvedBillId, toAdd)
              : Promise.resolve(),
          ]);
        })
      : Promise.resolve(),
  ]);

  return { billId: resolvedBillId, created };
}
