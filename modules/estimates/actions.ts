"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionOk,
  validationError,
  withActionErrorHandling,
  type ActionResult,
} from "@/core/errors";
import { requireRoleForAction } from "@/modules/auth/authz";
import { REVIEWER_EDIT_FIELDS } from "@/modules/estimates/reviewer-edit-fields";
import { recordReviewerEdit } from "@/modules/estimates/reviewer-edit-service";

const ESTIMATES_PATH = "/dashboard/estimates";

const reviewerEditFormSchema = z.object({
  estimateId: z.uuid(),
  fieldChanged: z.enum(REVIEWER_EDIT_FIELDS),
  newValue: z
    .string()
    .trim()
    .min(1, "Say what it should have been")
    .max(200, "Keep the correction short"),
});

export async function logReviewerEdit(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withActionErrorHandling("logReviewerEdit", async () => {
    const reviewer = await requireRoleForAction("ADMIN", "REVIEWER");

    const parsed = reviewerEditFormSchema.safeParse({
      estimateId: formData.get("estimateId") ?? "",
      fieldChanged: formData.get("fieldChanged") ?? "",
      newValue: formData.get("newValue") ?? "",
    });

    if (!parsed.success) return validationError(parsed.error);

    const edit = await recordReviewerEdit({
      estimateId: parsed.data.estimateId,
      reviewerUserId: reviewer.id,
      fieldChanged: parsed.data.fieldChanged,
      newValue: parsed.data.newValue,
    });

    revalidatePath(ESTIMATES_PATH);

    return actionOk(edit);
  });
}
