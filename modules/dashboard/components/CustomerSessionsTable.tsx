import { MessagesSquare } from "lucide-react";

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
import { formatDateTime, formatPhone } from "@/core/utils/format";
import { SessionStatusBadge } from "@/modules/dashboard/components/StatusBadge";
import type { SessionListRow } from "@/modules/intake/session-queries";

const COLUMNS = [
  "Status",
  "Customer",
  "Service address",
  "Location",
  "Photos",
  "Started",
] as const;

export function CustomerSessionsTable({
  sessions,
}: {
  sessions: readonly SessionListRow[];
}) {
  return (
    <TableScroller>
      <Table>
        <TableHead columns={COLUMNS} />
        <TableBody>
          {sessions.length === 0 ? (
            <TableEmptyRow columnCount={COLUMNS.length}>
              <EmptyState
                icon={MessagesSquare}
                title="No sessions yet"
                description="A session appears here the moment a customer opens the estimate chat on the website, even before they send a photo."
              />
            </TableEmptyRow>
          ) : (
            sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <SessionStatusBadge status={session.status} />
                    {session.isTestRecord ? (
                      <Badge tone="neutral">Test</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-900">
                    {session.customerName ?? "Not given yet"}
                  </p>
                  {session.customerPhone ? (
                    <p className="text-xs text-slate-500">
                      {formatPhone(session.customerPhone)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="line-clamp-2">
                    {session.serviceAddress ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {session.locationName ?? (
                    <span className="text-slate-400">Unrouted</span>
                  )}
                </TableCell>
                <TableCell>{session.photoCount}</TableCell>
                <TableCell className="whitespace-nowrap text-slate-500">
                  {formatDateTime(session.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableScroller>
  );
}
