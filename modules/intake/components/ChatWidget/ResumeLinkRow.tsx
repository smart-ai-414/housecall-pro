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
    <button
      type="button"
      title={`This link reopens your estimate for the next ${RESUME_TOKEN_TTL_DAYS} days`}
      onClick={() => {
        void navigator.clipboard
          .writeText(resumeUrl)
          .then(() => setHasCopied(true))
          .catch(() => setHasCopied(false));
      }}
      className="text-brand-600 hover:text-brand-900 inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
    >
      {hasCopied ? (
        <>
          <Check className="size-3.5" aria-hidden="true" />
          Link copied
        </>
      ) : (
        <>
          <Link2 className="size-3.5" aria-hidden="true" />
          Save your place
        </>
      )}
    </button>
  );
}
