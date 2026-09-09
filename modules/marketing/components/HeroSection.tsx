import { Clock, ShieldCheck, UserCheck } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { BRAND } from "@/core/config/branding";
import { StartEstimateButton } from "@/modules/marketing/components/StartEstimateButton";

const HERO_ASSURANCES = [
  {
    icon: Clock,
    title: "Two photos, four questions",
    body: "No site visit to get a number. Most people finish in under five minutes.",
  },
  {
    icon: UserCheck,
    title: "Priced by our team",
    body: "The assistant gathers details. A glazier sets the price and sends it.",
  },
  {
    icon: ShieldCheck,
    title: "Your photos stay private",
    body: "Location data is stripped from every image before anyone looks at it.",
  },
] as const;

export function HeroSection() {
  return (
    <section className="border-border-subtle from-brand-50 relative overflow-hidden border-b bg-gradient-to-b to-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="space-y-7">
          <p className="text-brand-800 ring-brand-200 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1">
            {BRAND.serviceAreaSummary}
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
            Broken glass? Send a photo, get a real estimate.
          </h1>

          <p className="max-w-xl text-lg text-slate-600">
            Our estimating assistant looks at two photos of the opening, asks a
            few short questions, and hands the details to our team. A glazier
            prices it against our rate book and sends the estimate to you.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <StartEstimateButton />
            <ButtonLink href={BRAND.phoneHref} variant="secondary" size="lg">
              Call {BRAND.phone}
            </ButtonLink>
          </div>

          <p className="text-sm text-slate-500">
            Windows, doors, storefronts, shower glass, mirrors, tabletops.
            Residential and commercial.
          </p>
        </div>

        <ul className="space-y-4 self-center">
          {HERO_ASSURANCES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="ring-border-subtle flex gap-4 rounded-xl bg-white p-5 ring-1"
            >
              <span className="bg-brand-50 flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="text-brand-700 size-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
