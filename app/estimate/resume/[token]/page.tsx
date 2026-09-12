import type { Metadata } from "next";

import { BRAND } from "@/core/config/branding";
import { RESUME_TOKEN_TTL_DAYS } from "@/core/security/resume-token-policy";
import { EstimateChatWidget } from "@/modules/intake/components/ChatWidget/EstimateChatWidget";
import { authenticateSession } from "@/modules/intake/session-service";

export const metadata: Metadata = {
  title: "Resume your estimate",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function LinkNoLongerValid() {
  return (
    <main className="bg-surface-muted flex min-h-dvh items-center justify-center p-6">
      <div className="ring-border-subtle w-full max-w-md rounded-2xl bg-white p-6 ring-1">
        <h1 className="text-lg font-semibold text-slate-900">
          That link is no longer valid
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Estimate links work for {RESUME_TOKEN_TTL_DAYS} days. Yours has either
          expired or was not complete. Nothing you sent us is lost — call and we
          will pick up where you left off.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={BRAND.phoneHref}
            className="bg-brand-700 hover:bg-brand-800 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          >
            Call {BRAND.phone}
          </a>
          <a
            href="/estimate"
            className="ring-border-strong rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1"
          >
            Start a new estimate
          </a>
        </div>
      </div>
    </main>
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

  return (
    <main className="bg-surface-muted flex min-h-dvh flex-col items-center justify-center sm:p-6">
      <div className="w-full sm:max-w-lg">
        <EstimateChatWidget
          variant="inline"
          resumeCredentials={{ sessionId, resumeToken }}
        />
      </div>
    </main>
  );
}
