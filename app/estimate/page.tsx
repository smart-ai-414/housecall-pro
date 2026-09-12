import type { Metadata } from "next";

import { BRAND } from "@/core/config/branding";
import { EstimateChatWidget } from "@/modules/intake/components/ChatWidget/EstimateChatWidget";

export const metadata: Metadata = {
  title: "Get a glass estimate",
  description: BRAND.tagline,
  robots: { index: false, follow: false },
};

export default function EstimateIntakePage() {
  return (
    <main className="bg-surface-muted flex min-h-dvh flex-col items-center justify-center sm:p-6">
      <div className="w-full sm:max-w-lg">
        <EstimateChatWidget variant="inline" />
      </div>
    </main>
  );
}
