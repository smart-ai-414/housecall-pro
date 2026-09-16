import {
  AlertTriangle,
  FileCheck2,
  MessagesSquare,
  PhoneCall,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";

import { Alert } from "@/components/ui/Alert";
import { ACCESS_DENIED_PARAM } from "@/core/config/navigation";
import { requireUser } from "@/modules/auth/authz";
import { ROLE_LABELS } from "@/modules/auth/roles";
import { AttentionList } from "@/modules/dashboard/components/AttentionList";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { PageHeading } from "@/modules/dashboard/components/PageHeading";
import {
  formatConversionRate,
  readDashboardMetrics,
} from "@/modules/dashboard/metrics";
import { listEstimateQueue } from "@/modules/estimates/estimate-queries";

export const metadata: Metadata = {
  title: "Overview",
};

const PIPELINE_STAGES = [
  {
    step: "01",
    stage: "It observes and asks",
    detail: "Classification, dimensions, and questions from a fixed bank.",
    isHuman: false,
  },
  {
    step: "02",
    stage: "The price book prices",
    detail: "Catalogue identifiers only. No amount is ever stored here.",
    isHuman: false,
  },
  {
    step: "03",
    stage: "You approve and send",
    detail: "Inside Housecall Pro. Nothing sends itself.",
    isHuman: true,
  },
] as const;

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [metricsRead, estimatesRead, params] = await Promise.all([
    readDashboardMetrics(),
    listEstimateQueue(),
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
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            icon={MessagesSquare}
            label="Sessions"
            value={metricsRead.data.sessionsTotal.toLocaleString()}
            caption={`${metricsRead.data.sessionsLast7Days.toLocaleString()} in the last 7 days`}
          />
          <MetricCard
            icon={FileCheck2}
            label="Pending review"
            value={metricsRead.data.pendingReview.toLocaleString()}
            caption="Drafts in Housecall Pro, unsent"
            tone={metricsRead.data.pendingReview > 0 ? "waiting" : "neutral"}
          />
          <MetricCard
            icon={TrendingUp}
            label="Conversion"
            value={formatConversionRate(metricsRead.data)}
            caption="Sessions reaching an estimate"
          />
          <MetricCard
            icon={PhoneCall}
            label="Awaiting customer"
            value={metricsRead.data.awaitingCustomer.toLocaleString()}
            caption="Open questions or a requested callback"
          />
          <MetricCard
            icon={Wrench}
            label="Quote by hand"
            value={metricsRead.data.needsReviewerCompletion.toLocaleString()}
            caption="No catalogue item covered the job"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Sync failures"
            value={metricsRead.data.syncFailures.toLocaleString()}
            caption="Never retried automatically"
            tone={metricsRead.data.syncFailures > 0 ? "stalled" : "neutral"}
          />
        </div>
      )}

      <div className="mt-5 grid gap-4.5 lg:grid-cols-[1.35fr_1fr]">
        {estimatesRead.ok ? (
          <AttentionList estimates={estimatesRead.data} />
        ) : (
          <Alert tone="warning" title="Queue unavailable">
            {estimatesRead.message}
          </Alert>
        )}

        <section className="border-border-subtle shadow-xs flex flex-col rounded-xl border bg-white">
          <header className="border-b border-slate-100 px-4.5 py-4">
            <h2 className="font-display text-brand-950 text-[15.5px] font-semibold tracking-[-0.005em]">
              Where the assistant stops
            </h2>
          </header>
          <ol className="flex flex-col gap-4 px-4.5 py-4">
            {PIPELINE_STAGES.map(({ step, stage, detail, isHuman }) => (
              <li key={step} className="flex gap-3.5">
                <span
                  className={
                    isHuman
                      ? "border-accent-100 bg-accent-50 text-accent-500 flex size-7.5 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-medium"
                      : "border-brand-100 bg-brand-50 text-brand-600 flex size-7.5 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-medium"
                  }
                >
                  {step}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {stage}
                  </span>
                  <span className="text-[13px] leading-5 text-slate-500">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
