import { CheckCircle2 } from "lucide-react";

import { BRAND } from "@/core/config/branding";
import { capturedFacts } from "@/modules/intake/progress";
import type { CapturedSummary } from "@/modules/intake/types";

export function CompletionNotice({
  locationName,
  summary,
}: {
  locationName: string | null;
  summary: CapturedSummary;
}) {
  const facts = capturedFacts(summary);

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-green-200 bg-green-50 p-5">
      <p className="flex items-center gap-2.5 text-green-700">
        <CheckCircle2 className="size-6 shrink-0" aria-hidden="true" />
        <span className="font-display text-lg font-semibold tracking-[-0.01em]">
          Sent to {locationName ?? BRAND.legalName}
        </span>
      </p>

      <p className="text-[15px] leading-6 text-green-700">
        A glazier prices this against our rate book and sends you the estimate —
        usually the same day. Nothing is quoted automatically.
      </p>

      {facts.length > 0 ? (
        <dl className="grid gap-3 border-t border-green-200 pt-4 sm:grid-cols-3">
          {facts.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-[11px] font-semibold tracking-[0.04em] text-green-600 uppercase">
                {label}
              </dt>
              <dd className="text-sm font-semibold text-green-700">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
