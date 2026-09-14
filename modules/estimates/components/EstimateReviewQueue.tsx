import { FileCheck2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableRow,
  TableScroller,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/core/utils/format";
import { EstimateStatusBadge } from "@/modules/dashboard/components/StatusBadge";
import { ReviewerEditForm } from "@/modules/estimates/components/ReviewerEditForm";
import type {
  EstimateObservation,
  EstimateQueueRow,
} from "@/modules/estimates/estimate-queries";
import { humanizeEnumLabel } from "@/modules/estimates/estimate-notes";

const COLUMNS = [
  "Status",
  "Customer",
  "What the assistant saw",
  "Location",
  "Housecall Pro ID",
  "Flags",
  "Created",
] as const;

function ObservationCell({
  observation,
}: {
  observation: EstimateObservation | null;
}) {
  if (!observation) {
    return <span className="text-slate-400">Not classified</span>;
  }

  const size =
    observation.widthInches !== null && observation.heightInches !== null
      ? `${Math.round(observation.widthInches)}in x ${Math.round(observation.heightInches)}in`
      : "no size read";

  return (
    <div className="space-y-0.5">
      <p className="font-medium text-slate-900">
        {humanizeEnumLabel(observation.assetType)} ·{" "}
        {humanizeEnumLabel(observation.issueType)}
      </p>
      <p className="text-xs text-slate-500">
        {Math.round(observation.confidenceScore * 100)}% confident · {size}
        {observation.customerConfirmedDimensions ? " (confirmed)" : ""}
      </p>
    </div>
  );
}

export function EstimateReviewQueue({
  estimates,
}: {
  estimates: readonly EstimateQueueRow[];
}) {
  return (
    <TableScroller>
      <Table>
        <TableHead columns={COLUMNS} />
        <TableBody>
          {estimates.length === 0 ? (
            <TableEmptyRow columnCount={COLUMNS.length}>
              <EmptyState
                icon={FileCheck2}
                title="Nothing waiting for review"
                description="Draft estimates arrive here once a session has photos, confirmed measurements and a catalogue match. They are created in Housecall Pro unsent and stay that way until a reviewer sends them."
              />
            </TableEmptyRow>
          ) : (
            estimates.map((estimate) => (
              <TableRow key={estimate.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <EstimateStatusBadge status={estimate.status} />
                    {estimate.isTestRecord ? (
                      <Badge tone="neutral">Test</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-900">
                    {estimate.customerName ?? "Unnamed"}
                  </p>
                  {estimate.serviceAddress ? (
                    <p className="line-clamp-1 text-xs text-slate-500">
                      {estimate.serviceAddress}
                    </p>
                  ) : null}
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                      Log a correction
                      {estimate.reviewerEditCount > 0
                        ? ` (${estimate.reviewerEditCount})`
                        : ""}
                    </summary>
                    <div className="mt-2 w-80 max-w-full">
                      <ReviewerEditForm estimateId={estimate.id} />
                    </div>
                  </details>
                </TableCell>
                <TableCell>
                  <ObservationCell observation={estimate.observation} />
                </TableCell>
                <TableCell>
                  {estimate.locationName ?? (
                    <span className="text-slate-400">Unrouted</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {estimate.housecallProEstimateId ?? (
                    <span className="text-slate-400">Not created yet</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {estimate.pricingBypassed ? (
                      <Badge tone="stalled">Pricing bypassed</Badge>
                    ) : null}
                    {estimate.observation?.isLowConfidence ? (
                      <Badge tone="waiting">Low confidence</Badge>
                    ) : null}
                    {estimate.observation?.photoQualityAssessment ===
                    "UNUSABLE" ? (
                      <Badge tone="stalled">Unusable photos</Badge>
                    ) : null}
                    {estimate.needsWorkByHand ? (
                      <Badge tone="waiting">Quote by hand</Badge>
                    ) : null}
                    {estimate.syncAttempts > 1 ? (
                      <Badge tone="neutral">
                        {estimate.syncAttempts} attempts
                      </Badge>
                    ) : null}
                    {estimate.lastSyncError ? (
                      <Badge tone="stalled">Sync error</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-slate-500">
                  {formatDateTime(estimate.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableScroller>
  );
}
