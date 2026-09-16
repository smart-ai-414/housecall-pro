"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/core/errors";
import { logReviewerEdit } from "@/modules/estimates/actions";
import {
  REVIEWER_EDIT_FIELD_LABELS,
  REVIEWER_EDIT_FIELDS,
} from "@/modules/estimates/reviewer-edit-fields";

type EditState = ActionResult<{ id: string }> | null;

async function submit(_state: EditState, formData: FormData) {
  return logReviewerEdit(formData);
}

const CONTROL_CLASSES =
  "h-10 w-full rounded-lg border border-border-strong bg-white px-3 text-[13.5px] text-slate-900 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none";

const LABEL_CLASSES =
  "text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase";

export function ReviewerEditForm({ estimateId }: { estimateId: string }) {
  const [state, formAction, isPending] = useActionState<EditState, FormData>(
    submit,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="estimateId" value={estimateId} />

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASSES}>What did you change?</span>
        <select
          name="fieldChanged"
          defaultValue="assetType"
          className={CONTROL_CLASSES}
        >
          {REVIEWER_EDIT_FIELDS.map((field) => (
            <option key={field} value={field}>
              {REVIEWER_EDIT_FIELD_LABELS[field]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASSES}>What should it have been?</span>
        <input name="newValue" maxLength={200} required className={CONTROL_CLASSES} />
      </label>

      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Save correction"}
      </Button>

      {state?.ok === false ? (
        <p className="text-xs text-red-700">{state.error.message}</p>
      ) : null}
      {state?.ok === true ? (
        <p className="text-xs text-green-700">
          Logged. This feeds the accuracy report.
        </p>
      ) : null}
    </form>
  );
}
