import Link from "next/link";
import { Phone } from "lucide-react";

import { BRAND } from "@/core/config/branding";

export function SiteHeader() {
  return (
    <header className="border-border-subtle sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="bg-brand-700 flex size-8 items-center justify-center rounded-md text-sm font-bold text-white"
            aria-hidden="true"
          >
            {BRAND.companyShortName.charAt(0)}
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            {BRAND.companyName}
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5">
          <a
            href={BRAND.phoneHref}
            className="hover:text-brand-700 hidden items-center gap-2 text-sm font-medium text-slate-700 sm:flex"
          >
            <Phone className="size-4" aria-hidden="true" />
            {BRAND.phone}
          </a>
          <Link
            href="/auth/signin"
            className="hover:bg-surface-sunken rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Staff login
          </Link>
        </nav>
      </div>
    </header>
  );
}
