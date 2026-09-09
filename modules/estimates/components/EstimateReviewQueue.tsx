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
import type { EstimateQueueRow } from "@/modules/estimates/estimate-queries";

const COLUMNS = [
  "Status",
  "Customer",
  "Location",
  "Housecall Pro ID",
  "Flags",
  "Created",
] as const;

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
