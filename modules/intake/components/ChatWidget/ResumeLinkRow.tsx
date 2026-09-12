"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { RESUME_TOKEN_TTL_DAYS } from "@/core/security/resume-token-policy";
import { buildResumeUrl } from "@/modules/intake/resume-link";

const NEVER_CHANGES = () => () => {};
const readBrowserOrigin = () => window.location.origin;
const NO_ORIGIN_WHILE_RENDERING_ON_THE_SERVER = () => "";

export function ResumeLinkRow({ resumeToken }: { resumeToken: string }) {
  const origin = useSyncExternalStore(
    NEVER_CHANGES,
    readBrowserOrigin,
    NO_ORIGIN_WHILE_RENDERING_ON_THE_SERVER,
  );
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (!hasCopied) return;
    const timer = setTimeout(() => setHasCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [hasCopied]);

  if (origin === "") return null;

  const resumeUrl = buildResumeUrl(resumeToken, origin);

  return (
    <div className="ring-border-subtle rounded-lg bg-white p-3 ring-1">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <Link2 className="size-3.5" aria-hidden="true" />
        Save your place
      </p>
      <p className="mt-1 text-xs text-slate-500">
        This link reopens your estimate for the next {RESUME_TOKEN_TTL_DAYS}{" "}
        days.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={resumeUrl}
          aria-label="Your estimate link"
          onFocus={(event) => event.currentTarget.select()}
          className="ring-border-strong min-w-0 flex-1 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600 ring-1"
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              .writeText(resumeUrl)
              .then(() => setHasCopied(true))
              .catch(() => setHasCopied(false));
          }}
          className="bg-brand-700 hover:bg-brand-800 inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          {hasCopied ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
    </div>
  );
}
