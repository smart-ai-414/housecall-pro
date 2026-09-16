import { Unlink } from "lucide-react";
import type { Metadata } from "next";

import { BRAND } from "@/core/config/branding";
import { RESUME_TOKEN_TTL_DAYS } from "@/core/security/resume-token-policy";
import { EstimateChatWidget } from "@/modules/intake/components/ChatWidget/EstimateChatWidget";
import { EstimatePageShell } from "@/modules/intake/components/EstimatePageShell";
import { ResumeRecapCard } from "@/modules/intake/components/ResumeRecapCard";
import { readSessionRecap } from "@/modules/intake/session-queries";
import { authenticateSession } from "@/modules/intake/session-service";

export const metadata: Metadata = {
  title: "Resume your estimate",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function LinkNoLongerValid() {
  return (
    <EstimatePageShell>
      <div className="border-border-subtle shadow-md mx-auto flex w-full max-w-[28.75rem] flex-col gap-5 rounded-2xl border bg-white p-8">
        <span className="flex size-13 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
          <Unlink className="size-6.5 text-amber-800" aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-brand-950 text-[1.625rem] leading-8 font-bold tracking-[-0.018em]">
            This link has expired
          </h1>
          <p className="text-[15.5px] leading-[25px] text-slate-600">
            Estimate links stay live for {RESUME_TOKEN_TTL_DAYS} days.{" "}
            <strong className="font-semibold text-slate-900">
              Nothing you sent us is lost
            </strong>{" "}
            — your photos and measurements are still on the job.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <a
            href={BRAND.phoneHref}
            className="bg-brand-700 hover:bg-brand-900 inline-flex h-12.5 items-center justify-center rounded-lg text-[15.5px] font-semibold text-white"
          >
            Call {BRAND.phone}
          </a>
          <a
            href="/estimate"
            className="border-border-strong hover:bg-surface-sunken text-brand-800 inline-flex h-12.5 items-center justify-center rounded-lg border text-[15.5px] font-semibold"
          >
            Start a new estimate
          </a>
        </div>

        <p className="border-t border-slate-100 pt-4 text-[13px] leading-5 text-slate-400">
          Mention the address and we will find your job in seconds.
        </p>
      </div>
    </EstimatePageShell>
  );
}

export default async function ResumeEstimatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resumeToken = decodeURIComponent(token);
  const sessionId = resumeToken.split(".")[0] ?? "";

  if (sessionId === "") return <LinkNoLongerValid />;

  try {
    await authenticateSession({ sessionId, resumeToken });
  } catch {
    return <LinkNoLongerValid />;
  }

  const recap = await readSessionRecap(sessionId).catch(() => null);

  return (
    <EstimatePageShell>
      {recap ? <ResumeRecapCard recap={recap} /> : null}
      <EstimateChatWidget
        variant="inline"
        resumeCredentials={{ sessionId, resumeToken }}
      />
    </EstimatePageShell>
  );
}
