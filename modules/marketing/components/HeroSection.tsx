import { Clock, Lock, ShieldCheck } from "lucide-react";

import { BRAND } from "@/core/config/branding";
import { StartEstimateButton } from "@/modules/marketing/components/StartEstimateButton";

const HERO_PROOF = [
  { icon: Clock, label: "Under five minutes" },
  { icon: ShieldCheck, label: `Licensed and insured · ${BRAND.licenseNumber}` },
  { icon: Lock, label: "Photos stay private" },
] as const;

function HeroConversationPreview() {
  return (
    <div className="shadow-2xl absolute right-0 bottom-8 w-[19rem] overflow-hidden rounded-2xl bg-white lg:-right-11">
      <div className="border-border-subtle bg-surface-muted flex items-center gap-2.5 border-b px-4 py-3">
        <span className="bg-accent-500 size-[7px] rounded-full" />
        <span className="text-xs font-semibold text-slate-700">
          Estimate assistant
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <p className="border-brand-100 bg-brand-50 text-brand-800 max-w-[88%] self-start rounded-[13px] rounded-bl-[3px] border px-3.5 py-2.5 text-[13.5px] leading-[21px]">
          That looks like a 60 × 36 in opening. Does that sound about right?
        </p>
        <p className="bg-brand-700 self-end rounded-[13px] rounded-br-[3px] px-3.5 py-2.5 text-[13.5px] text-white">
          Yes, about 5 foot
        </p>
        <p className="border-brand-100 bg-brand-50 text-brand-800 max-w-[88%] self-start rounded-[13px] rounded-bl-[3px] border px-3.5 py-2.5 text-[13.5px] leading-[21px]">
          Which floor is it on?
        </p>
      </div>
    </div>
  );
}

function HeroPhotoPlaceholder() {
  return (
    <div className="border-brand-600 absolute inset-0 overflow-hidden rounded-2xl border bg-[linear-gradient(155deg,#1B3742_0%,#2A6172_48%,#5796A5_100%)]">
      <div className="absolute top-[13%] left-[15%] h-[49%] w-[40%] border-[3px] border-white/35" />
      <div className="absolute top-[13%] left-[35%] h-[49%] w-[3px] bg-white/35" />
      <div className="absolute top-[32%] left-[17%] h-[2px] w-[32%] rotate-[21deg] bg-white/70" />
      <div className="absolute top-[37%] left-[25%] h-[2px] w-[17%] -rotate-[38deg] bg-white/55" />
      <div className="bg-ink/50 absolute inset-x-0 bottom-0 h-[26%]" />
      <span className="absolute bottom-5 left-5 font-mono text-[11px] tracking-[0.06em] text-white/60">
        [REPLACE WITH A REAL JOB PHOTO]
      </span>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="bg-ink relative overflow-hidden">
      <div
        aria-hidden="true"
        className="border-ink-line absolute -top-20 -right-28 size-[38.75rem] rotate-[18deg] border"
      />
      <div
        aria-hidden="true"
        className="border-ink-line absolute top-28 right-10 size-[26.25rem] rotate-[18deg] border"
      />

      <div className="relative mx-auto grid max-w-[74rem] gap-16 px-6 py-20 lg:grid-cols-[1fr_29.375rem] lg:items-center lg:py-24">
        <div className="flex flex-col gap-7">
          <span className="text-accent-500 text-xs font-semibold tracking-[0.12em] uppercase">
            {BRAND.serviceAreaSummary}
          </span>

          <h1 className="font-display text-[2.75rem] leading-[1.06] font-bold tracking-[-0.03em] text-balance text-white sm:text-[3.375rem] lg:text-[3.875rem]">
            Broken glass? Send a photo, get a real estimate.
          </h1>

          <span aria-hidden="true" className="bg-accent-500 h-[3px] w-[4.25rem]" />

          <p className="max-w-[32.5rem] text-lg leading-[1.65] text-pretty text-brand-200">
            Two photos and four short questions. Our estimating assistant works
            out the size from what it can see, then a glazier prices it against
            our own rate book and sends you the number.
          </p>

          <div className="flex flex-wrap items-center gap-3.5">
            <StartEstimateButton
              size="lg"
              variant="accent"
              label="Start with a photo"
              className="h-14 px-[1.875rem] text-[16.5px]"
            />
            <a
              href={BRAND.phoneHref}
              className="border-brand-600 inline-flex h-14 items-center justify-center rounded-lg border px-[1.875rem] text-[16.5px] font-semibold text-white hover:bg-white/5"
            >
              Call {BRAND.phone}
            </a>
          </div>

          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3 pt-2">
            {HERO_PROOF.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="text-brand-300 flex items-center gap-2.5 text-sm"
              >
                <Icon className="size-[17px]" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden h-[29.375rem] lg:block">
          <HeroPhotoPlaceholder />
          <HeroConversationPreview />
        </div>
      </div>
    </section>
  );
}
