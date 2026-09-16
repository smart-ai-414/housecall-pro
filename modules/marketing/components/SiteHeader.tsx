import Link from "next/link";
import { Phone } from "lucide-react";

import { BRAND } from "@/core/config/branding";
import { BrandMark } from "@/modules/marketing/components/BrandMark";

export function SiteHeader() {
  return (
    <header className="bg-ink sticky top-0 z-30">
      <div className="mx-auto flex h-[4.75rem] max-w-[74rem] items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark className="size-[2.125rem]" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold tracking-tight text-white">
              {BRAND.companyName}
            </span>
            <span className="text-ink-muted text-[11px] tracking-[0.08em] uppercase">
              Est. {BRAND.foundedYear}
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 sm:gap-7">
          <Link
            href="/auth/signin"
            className="text-brand-200 hidden text-sm font-medium hover:text-white sm:block"
          >
            Staff login
          </Link>
          <a
            href={BRAND.phoneHref}
            className="border-brand-600 inline-flex h-11 items-center gap-2.5 rounded-lg border px-5 text-[15px] font-semibold text-white hover:bg-white/5"
          >
            <Phone className="text-brand-300 size-4" aria-hidden="true" />
            {BRAND.phone}
          </a>
        </nav>
      </div>
    </header>
  );
}
