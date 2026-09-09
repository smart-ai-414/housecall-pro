import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { requireRole } from "@/modules/auth/authz";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import { EstimateReviewQueue } from "@/modules/estimates/components/EstimateReviewQueue";
import { listEstimateQueue } from "@/modules/estimates/estimate-queries";

export const metadata: Metadata = {
  title: "Estimates",
};

export default async function EstimatesPage() {
  await requireRole("ADMIN", "REVIEWER");
  const estimatesRead = await listEstimateQueue();

  return (
    <>
      <PageHeading
        title="Estimates"
        description="Drafts synced to Housecall Pro. Review and send them in Housecall Pro itself, where the price book lives."
      />

      <Alert tone="info" className="mb-6">
        Estimates are created unsent. No price generated in this application
        reaches a customer, and nothing here is sent automatically.
      </Alert>

      {!estimatesRead.ok ? (
        <Alert tone="warning" title="Estimates unavailable">
          {estimatesRead.message}
        </Alert>
      ) : (
        <Card>
          <EstimateReviewQueue estimates={estimatesRead.data} />
        </Card>
      )}
    </>
  );
}
