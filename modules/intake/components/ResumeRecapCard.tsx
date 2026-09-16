import { Clock } from "lucide-react";

import { RESUME_TOKEN_TTL_DAYS } from "@/core/security/resume-token-policy";
import { formatDateTime } from "@/core/utils/format";
import { capturedFacts } from "@/modules/intake/progress";
import type { SessionRecap } from "@/modules/intake/session-queries";

export function ResumeRecapCard({ recap }: { recap: SessionRecap }) {
  const firstName = recap.customerName?.trim().split(" ")[0] ?? null;
  const facts = capturedFacts(recap.summary);

  if (recap.outstandingQuestionCount > 0) {
    facts.push({
      label: "Still needed",
      value:
        recap.outstandingQuestionCount === 1
          ? "1 question"
          : `${recap.outstandingQuestionCount} questions`,
    });
  }

  return (
    <div className="border-border-subtle shadow-xs flex flex-col gap-4 rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-brand-950 text-[1.375rem] font-bold tracking-[-0.015em]">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[14.5px] leading-6 text-slate-600">
            Nothing you sent is lost.
            {recap.lastCustomerMessageAt
              ? ` Here is where we got to on ${formatDateTime(recap.lastCustomerMessageAt)}.`
              : " Here is where we got to."}
          </p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800">
          <Clock className="size-3.5" aria-hidden="true" />
          Link valid for {RESUME_TOKEN_TTL_DAYS} days
        </span>
      </div>

      {facts.length > 0 ? (
        <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
                {label}
              </dt>
              <dd className="text-brand-800 text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
