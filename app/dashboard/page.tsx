import {
  AlertTriangle,
  FileCheck2,
  MessagesSquare,
  PhoneCall,
  Ratio,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ACCESS_DENIED_PARAM } from "@/core/config/navigation";
import { requireUser } from "@/modules/auth/authz";
import { ROLE_LABELS } from "@/modules/auth/roles";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import {
  formatConversionRate,
  readDashboardMetrics,
} from "@/modules/dashboard/metrics";

export const metadata: Metadata = {
  title: "Overview",
};

const PIPELINE_STAGES = [
  {
    stage: "Observe",
    owner: "The assistant",
    detail:
      "Reads the photos, classifies the asset and issue, estimates dimensions from a scale reference, and asks the customer to confirm them.",
  },
  {
    stage: "Price",
    owner: "The Housecall Pro price book",
    detail:
      "Matches the job to catalogue items. Nothing in this application calculates a price, and no price is stored here.",
  },
  {
    stage: "Approve",
    owner: "A person",
    detail:
      "Every estimate lands in Housecall Pro unsent. A reviewer checks it, corrects what is wrong, and sends it.",
  },
] as const;

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [metricsRead, params] = await Promise.all([
    readDashboardMetrics(),
    searchParams,
  ]);

  const wasAccessDenied = params[ACCESS_DENIED_PARAM] !== undefined;

  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0] || "there"}`}
        description="Intake volume, the review backlog, and where jobs are getting stuck."
      />

      {wasAccessDenied ? (
        <Alert
          tone="warning"
          title="Not available to your role"
          className="mb-6"
        >
          {`Your role is ${ROLE_LABELS[user.role]}, which does not include that section. Ask an administrator if you need access.`}
        </Alert>
      ) : null}

      {!metricsRead.ok ? (
        <Alert tone="warning" title="Metrics unavailable">
          {metricsRead.message}
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              icon={MessagesSquare}
              label="Total sessions"
              value={metricsRead.data.sessionsTotal.toLocaleString()}
              caption={`${metricsRead.data.sessionsLast7Days.toLocaleString()} in the last 7 days`}
            />
            <MetricCard
              icon={FileCheck2}
              label="Pending review"
              value={metricsRead.data.pendingReview.toLocaleString()}
              caption="Draft estimates in Housecall Pro, unsent"
            />
            <MetricCard
              icon={Ratio}
              label="Conversion rate"
              value={formatConversionRate(metricsRead.data)}
              caption="Sessions that reached a synced estimate"
            />
            <MetricCard
              icon={PhoneCall}
              label="Awaiting customer"
              value={metricsRead.data.awaitingCustomer.toLocaleString()}
              caption="Open questions or a requested callback"
            />
            <MetricCard
              icon={Wrench}
              label="Needs a quote by hand"
              value={metricsRead.data.needsReviewerCompletion.toLocaleString()}
              caption="No catalogue item covered the job"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Sync failures"
              value={metricsRead.data.syncFailures.toLocaleString()}
              caption="Never retried automatically"
            />
          </div>

          {metricsRead.data.sessionsTotal === 0 ? (
            <Alert tone="info" title="No intake yet" className="mt-6">
              The chat widget is live on the landing page. Start a session there
              to see it appear under Sessions.
            </Alert>
          ) : null}
        </>
      )}

      <Card className="mt-8">
        <CardHeader
          title="How a job moves through the system"
          description="Three responsibilities that never collapse into one."
        />
        <CardBody className="divide-border-subtle divide-y">
          {PIPELINE_STAGES.map(({ stage, owner, detail }) => (
            <div
              key={stage}
              className="grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr] sm:gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{stage}</p>
                <p className="text-xs text-slate-500">{owner}</p>
              </div>
              <p className="text-sm text-slate-600">{detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
