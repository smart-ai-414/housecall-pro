"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import type { ActionResult } from "@/core/errors";
import {
  clearLocationApiKey,
  saveLocationApiKey,
} from "@/modules/tenancy/actions";
import type { FranchiseLocationRow } from "@/modules/tenancy/location-queries";

type KeyState = ActionResult<{ id: string }> | null;

async function submitSave(
  _previous: KeyState,
  formData: FormData,
): Promise<KeyState> {
  return saveLocationApiKey(formData);
}

async function submitClear(
  _previous: KeyState,
  formData: FormData,
): Promise<KeyState> {
  return clearLocationApiKey(formData);
}

export function HousecallProCredentialsForm({
  locations,
}: {
  locations: readonly FranchiseLocationRow[];
}) {
  const [saveState, saveAction, isSaving] = useActionState<KeyState, FormData>(
    submitSave,
    null,
  );
  const [clearState, clearAction, isClearing] = useActionState<
    KeyState,
    FormData
  >(submitClear, null);

  const fieldErrors =
    saveState && !saveState.ok ? saveState.error.fieldErrors : undefined;
  const formError =
    saveState && !saveState.ok && !saveState.error.fieldErrors
      ? saveState.error.message
      : null;
  const clearError =
    clearState && !clearState.ok ? clearState.error.message : null;

  if (locations.length === 0) {
    return (
      <Card>
        <CardHeader title="Housecall Pro API keys" />
        <CardBody>
          <Alert tone="info">
            Add a franchise location first. API keys are stored per location,
            because each franchise has its own Housecall Pro account.
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Housecall Pro API keys"
        description="Stored encrypted with AES-256-GCM. Once saved, a key is never shown again — replace it rather than reading it back."
      />
      <CardBody className="space-y-5">
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        {clearError ? <Alert tone="error">{clearError}</Alert> : null}
        {saveState?.ok ? (
          <Alert tone="success">Key encrypted and stored.</Alert>
        ) : null}
        {clearState?.ok ? <Alert tone="success">Key removed.</Alert> : null}

        <form action={saveAction} className="space-y-5" noValidate>
          <Field
            htmlFor="locationId"
            label="Location"
            required
            errors={fieldErrors?.locationId}
          >
            <Select
              id="locationId"
              name="locationId"
              required
              defaultValue={locations[0]?.id}
              invalid={Boolean(fieldErrors?.locationId)}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.hasApiKey ? " (key stored)" : " (no key)"}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            htmlFor="apiKey"
            label="API key"
            hint="Paste the key from the Housecall Pro developer settings."
            required
            errors={fieldErrors?.apiKey}
          >
            <Input
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              required
              invalid={Boolean(fieldErrors?.apiKey)}
            />
          </Field>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Encrypting…" : "Save key"}
          </Button>
        </form>

        <form
          action={clearAction}
          className="border-border-subtle flex flex-wrap items-end gap-3 border-t pt-5"
        >
          <Field htmlFor="clearLocationId" label="Remove a stored key">
            <Select
              id="clearLocationId"
              name="locationId"
              defaultValue={locations.find((l) => l.hasApiKey)?.id ?? ""}
            >
              <option value="">Select a location</option>
              {locations
                .filter((location) => location.hasApiKey)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary" disabled={isClearing}>
            {isClearing ? "Removing…" : "Remove key"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
