import type { Metadata } from "next";

import { BRAND } from "@/core/config/branding";
import { EstimateChatWidget } from "@/modules/intake/components/ChatWidget/EstimateChatWidget";
import { EstimatePageShell } from "@/modules/intake/components/EstimatePageShell";

export const metadata: Metadata = {
  title: "Get a glass estimate",
  description: BRAND.tagline,
  robots: { index: false, follow: false },
};

export default function EstimateIntakePage() {
  return (
    <EstimatePageShell>
      <EstimateChatWidget variant="inline" />
    </EstimatePageShell>
  );
}
