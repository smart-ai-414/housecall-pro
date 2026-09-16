"use client";

import { UserRound } from "lucide-react";
import { useId, useState } from "react";

import {
  StreamCard,
  StreamCardNote,
} from "@/modules/intake/components/ChatWidget/StreamCard";

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
  "h-11.5 w-full rounded-lg border border-border-strong bg-white px-3.5 text-[14.5px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none";

const LABEL_CLASSES =
  "text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase";

export function ContactDetailsForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (draft: ContactDetailsDraft) => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<ContactDetailsDraft>(EMPTY_DRAFT);

  const canSubmit =
    draft.name.trim().length > 0 &&
    draft.phone.trim().length >= 7 &&
    draft.serviceAddress.trim().length >= 8;

  return (
    <StreamCard>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit && !isSubmitting) onSubmit(draft);
        }}
      >
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.03em] text-slate-500 uppercase">
          <UserRound className="size-4" aria-hidden="true" />
          Your details
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${fieldId}-name`} className={LABEL_CLASSES}>
              Name
            </label>
            <input
              id={`${fieldId}-name`}
              className={FIELD_CLASSES}
              placeholder="Full name"
              autoComplete="name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${fieldId}-phone`} className={LABEL_CLASSES}>
              Mobile
            </label>
            <input
              id={`${fieldId}-phone`}
              className={FIELD_CLASSES}
              placeholder="(000) 000-0000"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-address`} className={LABEL_CLASSES}>
            Where the work is
          </label>
          <input
            id={`${fieldId}-address`}
            className={FIELD_CLASSES}
            placeholder="Street, city, state, ZIP"
            autoComplete="street-address"
            value={draft.serviceAddress}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                serviceAddress: event.target.value,
              }))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-email`} className={LABEL_CLASSES}>
            Email, optional
          </label>
          <input
            id={`${fieldId}-email`}
            className={FIELD_CLASSES}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(event) =>
              setDraft((current) => ({ ...current, email: event.target.value }))
            }
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="bg-brand-700 hover:bg-brand-900 disabled:bg-brand-200 inline-flex h-11.5 items-center justify-center self-start rounded-lg px-5 text-[14.5px] font-semibold text-white"
        >
          {isSubmitting ? "Sending…" : "Send this to the team"}
        </button>

        <StreamCardNote>
          We use the ZIP code to route your job to the right branch.
        </StreamCardNote>
      </form>
    </StreamCard>
  );
}
