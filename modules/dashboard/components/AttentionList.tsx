import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/core/utils/format";
import { humanizeEnumLabel } from "@/modules/estimates/estimate-notes";
import type { EstimateQueueRow } from "@/modules/estimates/estimate-queries";

interface AttentionFlag {
  label: string;
  tone: BadgeTone;
}

function flagFor(estimate: EstimateQueueRow): AttentionFlag | null {
  if (estimate.status === "SYNC_FAILED") {
    return { label: "Sync failed", tone: "stalled" };
  }
  if (estimate.pricingBypassed) {
    return { label: "Pricing bypassed", tone: "stalled" };
  }
  if (estimate.needsWorkByHand) {
    return { label: "Quote by hand", tone: "waiting" };
  }
  if (estimate.observation?.photoQualityAssessment === "UNUSABLE") {
    return { label: "Unusable photos", tone: "stalled" };
  }
  if (estimate.observation?.isLowConfidence) {
    return { label: "Low confidence", tone: "waiting" };
  }
  if (estimate.locationName === null) {
    return { label: "Unrouted", tone: "active" };
  }
  return null;
}

function describeObservation(estimate: EstimateQueueRow): string {
  const { observation } = estimate;
  if (!observation) return "Not classified yet";

  const parts = [
    `${humanizeEnumLabel(observation.assetType) ?? observation.assetType} · ${humanizeEnumLabel(observation.issueType) ?? observation.issueType}`,
    `${Math.round(observation.confidenceScore * 100)}% confident`,
  ];

  if (observation.widthInches !== null && observation.heightInches !== null) {
    parts.push(
      `${Math.round(observation.widthInches)} × ${Math.round(observation.heightInches)} in`,
    );
  }

  return parts.join(" · ");
}

const MAX_ROWS = 5;

export function AttentionList({
  estimates,
}: {
  estimates: readonly EstimateQueueRow[];
}) {
  const flagged = estimates
    .map((estimate) => ({ estimate, flag: flagFor(estimate) }))
    .filter(
      (row): row is { estimate: EstimateQueueRow; flag: AttentionFlag } =>
        row.flag !== null,
    )
    .slice(0, MAX_ROWS);

  return (
    <section className="border-border-subtle shadow-xs flex flex-col rounded-xl border bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-4.5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-brand-950 text-[15.5px] font-semibold tracking-[-0.005em]">
            Needs you today
          </h2>
          <p className="text-[12.5px] text-slate-400">
            Ordered by how long the customer has been waiting.
          </p>
        </div>
        <Link
          href="/dashboard/estimates"
          className="text-brand-600 hover:text-brand-900 shrink-0 text-[13px] font-semibold"
        >
          View all
        </Link>
      </header>

      {flagged.length === 0 ? (
        <p className="flex items-center gap-2.5 px-4.5 py-8 text-sm text-slate-500">
          <CheckCircle2 className="size-4.5 text-green-700" aria-hidden="true" />
          Nothing is stuck. Every synced estimate is waiting on a reviewer only.
        </p>
      ) : (
        <ul className="flex flex-col">
          {flagged.map(({ estimate, flag }) => (
            <li
              key={estimate.id}
              className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-slate-100 px-4.5 py-3.5 last:border-b-0"
            >
              <Badge tone={flag.tone}>{flag.label}</Badge>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-slate-900">
                  {estimate.customerName ?? "Unnamed"}
                  {estimate.serviceAddress
                    ? ` · ${estimate.serviceAddress}`
                    : ""}
                </span>
                <span className="truncate text-[12.5px] text-slate-500">
                  {describeObservation(estimate)}
                </span>
              </div>
              <span className="shrink-0 text-[12.5px] text-slate-400">
                {formatRelativeTime(estimate.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
