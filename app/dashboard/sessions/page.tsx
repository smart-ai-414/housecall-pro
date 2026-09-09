import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/modules/auth/authz";
import { CustomerSessionsTable } from "@/modules/dashboard/components/CustomerSessionsTable";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import { listRecentSessions } from "@/modules/intake/session-queries";

export const metadata: Metadata = {
  title: "Sessions",
};

export default async function SessionsPage() {
  await requireUser();
  const sessionsRead = await listRecentSessions();

  return (
    <>
      <PageHeading
        title="Sessions"
        description="Every customer conversation, including the ones that stopped halfway. An abandoned session is still a lead."
      />

      {!sessionsRead.ok ? (
        <Alert tone="warning" title="Sessions unavailable">
          {sessionsRead.message}
        </Alert>
      ) : (
        <Card>
          <CustomerSessionsTable sessions={sessionsRead.data} />
        </Card>
      )}
    </>
  );
}
