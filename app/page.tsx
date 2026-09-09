import type { Metadata } from "next";

import { EstimateChatWidget } from "@/modules/intake/components/ChatWidget/EstimateChatWidget";
import { AssuranceSection } from "@/modules/marketing/components/AssuranceSection";
import { HeroSection } from "@/modules/marketing/components/HeroSection";
import { HowItWorksSection } from "@/modules/marketing/components/HowItWorksSection";
import { SiteFooter } from "@/modules/marketing/components/SiteFooter";
import { SiteHeader } from "@/modules/marketing/components/SiteHeader";

export const metadata: Metadata = {
  title: "Glass repair and replacement estimates",
};

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <HowItWorksSection />
        <AssuranceSection />
      </main>
      <SiteFooter />
      <EstimateChatWidget />
    </>
  );
}
