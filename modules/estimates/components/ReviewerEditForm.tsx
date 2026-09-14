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

export function ReviewerEditForm({ estimateId }: { estimateId: string }) {
  const [state, formAction, isPending] = useActionState<EditState, FormData>(
    submit,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="estimateId" value={estimateId} />

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40">
          <span className="text-xs font-medium text-slate-600">
            What did you change?
          </span>
          <select
            name="fieldChanged"
            defaultValue="assetType"
            className="ring-border-strong focus:ring-brand-600 mt-1 w-full rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 focus:ring-2"
          >
            {REVIEWER_EDIT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {REVIEWER_EDIT_FIELD_LABELS[field]}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-48 flex-1">
          <span className="text-xs font-medium text-slate-600">
            What should it have been?
          </span>
          <input
            name="newValue"
            maxLength={200}
            required
            className="ring-border-strong focus:ring-brand-600 mt-1 w-full rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 focus:ring-2"
          />
        </label>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Log correction"}
        </Button>
      </div>

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
