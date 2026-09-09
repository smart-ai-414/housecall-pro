"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import type { ActionResult } from "@/core/errors";
import { saveFranchiseLocation } from "@/modules/tenancy/actions";
import type { FranchiseLocationRow } from "@/modules/tenancy/location-queries";

type SaveState = ActionResult<{ id: string }> | null;

async function submit(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  return saveFranchiseLocation(formData);
}

export function FranchiseLocationForm({
  locations,
}: {
  locations: readonly FranchiseLocationRow[];
}) {
  const [editingId, setEditingId] = useState<string>("");
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(
    submit,
    null,
  );

  const editing = locations.find((location) => location.id === editingId);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError =
    state && !state.ok && !state.error.fieldErrors ? state.error.message : null;

  return (
    <Card>
      <CardHeader
        title={editing ? `Edit ${editing.name}` : "Add a location"}
        description="Territories are matched by ZIP code when a customer gives their service address."
        action={
          <select
            aria-label="Location to edit"
            value={editingId}
            onChange={(event) => setEditingId(event.target.value)}
            className="ring-border-strong rounded-lg bg-white px-3 py-1.5 text-sm ring-1"
          >
            <option value="">New location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        }
      />

      <CardBody>
        <form
          action={formAction}
          className="space-y-5"
          key={editingId || "new"}
          noValidate
        >
          <input type="hidden" name="locationId" value={editingId} />

          {formError ? <Alert tone="error">{formError}</Alert> : null}
          {state?.ok ? <Alert tone="success">Location saved.</Alert> : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="name"
              label="Location name"
              required
              errors={fieldErrors?.name}
            >
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name}
                placeholder="North Metro"
                required
                invalid={Boolean(fieldErrors?.name)}
              />
            </Field>

            <Field
              htmlFor="slug"
              label="Slug"
              hint="Lowercase, hyphenated. Used in URLs and logs."
              required
              errors={fieldErrors?.slug}
            >
              <Input
                id="slug"
                name="slug"
                defaultValue={editing?.slug}
                placeholder="north-metro"
                className="font-mono"
                required
                invalid={Boolean(fieldErrors?.slug)}
              />
            </Field>
          </div>

          <Field
            htmlFor="zipCodes"
            label="Territory ZIP codes"
            hint="Five digits each, separated by spaces, commas or new lines. Two active locations claiming the same ZIP sends the job to a human instead of guessing."
            errors={fieldErrors?.zipCodes}
          >
            <Textarea
              id="zipCodes"
              name="zipCodes"
              rows={4}
              defaultValue={editing?.territory.zipCodes.join(" ")}
              placeholder="55401 55402 55403"
              invalid={Boolean(fieldErrors?.zipCodes)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="housecallProAccountId"
              label="Housecall Pro account ID"
              errors={fieldErrors?.housecallProAccountId}
            >
              <Input
                id="housecallProAccountId"
                name="housecallProAccountId"
                defaultValue={editing?.housecallProAccountId ?? ""}
                className="font-mono"
                invalid={Boolean(fieldErrors?.housecallProAccountId)}
              />
            </Field>

            <Field
              htmlFor="priceBookId"
              label="Price book ID"
              hint="Which catalogue this location prices against."
              errors={fieldErrors?.priceBookId}
            >
              <Input
                id="priceBookId"
                name="priceBookId"
                defaultValue={editing?.priceBookId ?? ""}
                className="font-mono"
                invalid={Boolean(fieldErrors?.priceBookId)}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing ? editing.isActive : true}
              className="border-border-strong text-brand-700 size-4 rounded"
            />
            Active. Inactive locations are skipped by territory routing.
          </label>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Add location"}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingId("")}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
