"use client";

import { AlertTriangle, FileCheck2, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/core/utils/cn";
import { formatDateTime } from "@/core/utils/format";
import { EstimateStatusBadge } from "@/modules/dashboard/components/StatusBadge";
import { ReviewerEditForm } from "@/modules/estimates/components/ReviewerEditForm";
import type {
  EstimateObservation,
  EstimateQueueRow,
} from "@/modules/estimates/estimate-queries";

function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function observationHeadline(observation: EstimateObservation | null): string {
  if (!observation) return "Not classified";
  return `${humanize(observation.assetType)} · ${humanize(observation.issueType).toLowerCase()}`;
}

function observationDetail(observation: EstimateObservation | null): string {
  if (!observation) return "No classification recorded";

  const size =
    observation.widthInches !== null && observation.heightInches !== null
      ? `${Math.round(observation.widthInches)} × ${Math.round(observation.heightInches)} in`
      : "no size read";

  return `${Math.round(observation.confidenceScore * 100)}% confident · ${size}${
    observation.customerConfirmedDimensions ? " · confirmed" : ""
  }`;
}

function RowFlags({ estimate }: { estimate: EstimateQueueRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {estimate.pricingBypassed ? (
        <Badge tone="stalled">Pricing bypassed</Badge>
      ) : null}
      {estimate.observation?.isLowConfidence ? (
        <Badge tone="waiting">Low confidence</Badge>
      ) : null}
      {estimate.observation?.photoQualityAssessment === "UNUSABLE" ? (
        <Badge tone="stalled">Unusable photos</Badge>
      ) : null}
      {estimate.needsWorkByHand ? (
        <Badge tone="waiting">Quote by hand</Badge>
      ) : null}
      {estimate.syncAttempts > 1 ? (
        <Badge tone="neutral">{estimate.syncAttempts} attempts</Badge>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-right text-[13px] font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function EstimateDrawer({
  estimate,
  onClose,
}: {
  estimate: EstimateQueueRow;
  onClose: () => void;
}) {
  const { observation } = estimate;

  return (
    <aside
      aria-label={`Details for ${estimate.customerName ?? "unnamed estimate"}`}
      className="border-border-subtle shadow-xs flex w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-white lg:w-[24.75rem]"
    >
      <header className="flex items-start justify-between gap-3.5 border-b border-slate-100 px-4.5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-brand-950 truncate text-base font-semibold tracking-[-0.005em]">
            {estimate.customerName ?? "Unnamed"}
          </p>
          <p className="truncate font-mono text-xs text-slate-500">
            {estimate.housecallProEstimateId ?? "not created yet"} ·{" "}
            {formatDateTime(estimate.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-slate-700"
        >
          <X className="size-4.5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto px-4.5 py-4">
        {estimate.status === "SYNC_FAILED" ? (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
            <AlertTriangle
              className="mt-0.5 size-4.5 shrink-0 text-red-700"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <p className="text-[13.5px] font-semibold text-red-700">
                Sync failed after {estimate.syncAttempts}{" "}
                {estimate.syncAttempts === 1 ? "attempt" : "attempts"}
              </p>
              <p className="text-[12.5px] leading-[19px] text-red-700">
                {estimate.lastSyncError ??
                  "Housecall Pro rejected the request."}{" "}
                Never retried automatically — a blind retry could duplicate the
                estimate.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
            What the assistant recorded
          </p>
          <div className="rounded-xl border border-slate-100">
            <DetailRow
              label="Asset"
              value={observation ? humanize(observation.assetType) : "—"}
            />
            <DetailRow
              label="Issue"
              value={observation ? humanize(observation.issueType) : "—"}
            />
            <DetailRow
              label="Confidence"
              value={
                observation
                  ? `${Math.round(observation.confidenceScore * 100)}%`
                  : "—"
              }
            />
            <DetailRow
              label="Opening"
              value={
                observation?.widthInches != null &&
                observation.heightInches != null
                  ? `${Math.round(observation.widthInches)} × ${Math.round(observation.heightInches)} in${
                      observation.customerConfirmedDimensions
                        ? " · confirmed"
                        : ""
                    }`
                  : "no size read"
              }
            />
            <DetailRow
              label="Location"
              value={estimate.locationName ?? "Unrouted"}
            />
            <DetailRow
              label="Corrections logged"
              value={String(estimate.reviewerEditCount)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
            Log a correction
          </p>
          <p className="text-[12.5px] leading-[19px] text-slate-500">
            What you changed in Housecall Pro. This is the ground truth the
            accuracy report is built from.
          </p>
          <ReviewerEditForm estimateId={estimate.id} />
        </div>
      </div>
    </aside>
  );
}

export function EstimateReviewQueue({
  estimates,
}: {
  estimates: readonly EstimateQueueRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    estimates.find((estimate) => estimate.id === selectedId) ?? null;

  if (estimates.length === 0) {
    return (
      <div className="border-border-subtle shadow-xs rounded-xl border bg-white px-5 py-8">
        <EmptyState
          icon={FileCheck2}
          title="Nothing waiting for review"
          description="Draft estimates arrive here once a session has photos, confirmed measurements and a catalogue match. They are created in Housecall Pro unsent and stay that way until a reviewer sends them."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="border-border-subtle shadow-xs min-w-0 flex-1 overflow-hidden rounded-xl border bg-white">
        <div className="border-border-subtle bg-surface-muted hidden border-b px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-slate-500 uppercase lg:grid lg:grid-cols-[8.25rem_1.1fr_1.4fr_8rem] lg:gap-3">
          <span>Status</span>
          <span>Customer</span>
          <span>What the assistant saw</span>
          <span>Flags</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {estimates.map((estimate) => (
            <li key={estimate.id}>
              <button
                type="button"
                onClick={() =>
                  setSelectedId((current) =>
                    current === estimate.id ? null : estimate.id,
                  )
                }
                aria-pressed={selectedId === estimate.id}
                className={cn(
                  "hover:bg-surface-muted grid w-full gap-x-3 gap-y-2 px-4 py-3.5 text-left transition-colors lg:grid-cols-[8.25rem_1.1fr_1.4fr_8rem] lg:items-center",
                  selectedId === estimate.id &&
                    "bg-brand-50 border-accent-500 hover:bg-brand-50 border-l-[3px] pl-[13px]",
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <EstimateStatusBadge status={estimate.status} />
                  {estimate.isTestRecord ? (
                    <Badge tone="neutral">Test</Badge>
                  ) : null}
                </span>

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {estimate.customerName ?? "Unnamed"}
                  </span>
                  {estimate.serviceAddress ? (
                    <span className="truncate text-[12.5px] text-slate-500">
                      {estimate.serviceAddress}
                    </span>
                  ) : null}
                </span>

                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    {observationHeadline(estimate.observation)}
                  </span>
                  <span className="truncate text-[12.5px] text-slate-500">
                    {observationDetail(estimate.observation)}
                  </span>
                </span>

                <RowFlags estimate={estimate} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <EstimateDrawer
          estimate={selected}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
