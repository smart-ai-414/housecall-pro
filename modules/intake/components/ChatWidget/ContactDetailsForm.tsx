"use client";

import { useState } from "react";

export interface ContactDetailsDraft {
  name: string;
  phone: string;
  email: string;
  serviceAddress: string;
}

const EMPTY_DRAFT: ContactDetailsDraft = {
  name: "",
  phone: "",
  email: "",
  serviceAddress: "",
};

const FIELD_CLASSES =
  "w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-border-strong focus:ring-2 focus:ring-brand-600";

export function ContactDetailsForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (draft: ContactDetailsDraft) => void;
}) {
  const [draft, setDraft] = useState<ContactDetailsDraft>(EMPTY_DRAFT);

  const canSubmit =
    draft.name.trim().length > 0 &&
    draft.phone.trim().length >= 7 &&
    draft.serviceAddress.trim().length >= 8;

  return (
    <form
      className="ring-border-subtle space-y-2.5 rounded-lg bg-white p-3 ring-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit && !isSubmitting) onSubmit(draft);
      }}
    >
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Where should we send the estimate?
      </p>

      <label className="block">
        <span className="sr-only">Your name</span>
        <input
          className={FIELD_CLASSES}
          placeholder="Your name"
          autoComplete="name"
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>

      <label className="block">
        <span className="sr-only">Mobile number</span>
        <input
          className={FIELD_CLASSES}
          placeholder="Mobile number"
          type="tel"
          autoComplete="tel"
          value={draft.phone}
          onChange={(event) =>
            setDraft((current) => ({ ...current, phone: event.target.value }))
          }
        />
      </label>

      <label className="block">
        <span className="sr-only">Email, optional</span>
        <input
          className={FIELD_CLASSES}
          placeholder="Email (optional)"
          type="email"
          autoComplete="email"
          value={draft.email}
          onChange={(event) =>
            setDraft((current) => ({ ...current, email: event.target.value }))
          }
        />
      </label>

      <label className="block">
        <span className="sr-only">Service address</span>
        <input
          className={FIELD_CLASSES}
          placeholder="Service address, including ZIP"
          autoComplete="street-address"
          value={draft.serviceAddress}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              serviceAddress: event.target.value,
            }))
          }
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white"
      >
        {isSubmitting ? "Sending…" : "Send my details"}
      </button>

      <p className="text-xs text-slate-500">
        We use the ZIP code to route your job to the right branch.
      </p>
    </form>
  );
}
