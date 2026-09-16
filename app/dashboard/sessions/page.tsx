import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/modules/auth/authz";
import { CustomerSessionsTable } from "@/modules/dashboard/components/CustomerSessionsTable";
import { FilterChips } from "@/modules/dashboard/components/FilterChips";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import {
  SESSION_FILTERS,
  SESSION_FILTER_LABELS,
  isSessionFilter,
  listRecentSessions,
  readSessionFilterCounts,
} from "@/modules/intake/session-queries";

export const metadata: Metadata = {
  title: "Sessions",
};

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();

  const params = await searchParams;
  const requested = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const filter = isSessionFilter(requested) ? requested : "ALL";

  const [sessionsRead, countsRead] = await Promise.all([
    listRecentSessions(filter),
    readSessionFilterCounts(),
  ]);

  return (
    <>
      <PageHeading
        title="Sessions"
        description="Every customer conversation, including the ones that stopped halfway. An abandoned session is still a lead."
      />

      <div className="mb-4">
        <FilterChips
          label="Filter sessions by status"
          chips={SESSION_FILTERS.map((candidate) => ({
            key: candidate,
            label: SESSION_FILTER_LABELS[candidate],
            href:
              candidate === "ALL"
                ? "/dashboard/sessions"
                : `/dashboard/sessions?filter=${candidate}`,
            count: countsRead.ok ? countsRead.data[candidate] : undefined,
            isActive: candidate === filter,
          }))}
        />
      </div>

      {!sessionsRead.ok ? (
        <Alert tone="warning" title="Sessions unavailable">
          {sessionsRead.message}
        </Alert>
      ) : (
        <Card className="overflow-hidden">
          <CustomerSessionsTable sessions={sessionsRead.data} />
        </Card>
      )}
    </>
  );
}
