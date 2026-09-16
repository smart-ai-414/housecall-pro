import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
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
        title="Review queue"
        description="Drafts synced to Housecall Pro, created unsent. Pricing and sending happen there, where the price book lives."
      />

      <Alert tone="info" className="mb-4">
        Estimates are created unsent. No price generated in this application
        reaches a customer, and nothing here is sent automatically.
      </Alert>

      {!estimatesRead.ok ? (
        <Alert tone="warning" title="Estimates unavailable">
          {estimatesRead.message}
        </Alert>
      ) : (
        <EstimateReviewQueue estimates={estimatesRead.data} />
      )}
    </>
  );
}
