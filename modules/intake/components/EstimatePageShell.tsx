import Link from "next/link";
import { Phone } from "lucide-react";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";
import { BrandMark } from "@/modules/marketing/components/BrandMark";

export function EstimatePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-sunken flex min-h-dvh flex-col">
      <header className="border-border-subtle flex h-17 shrink-0 items-center justify-between gap-4 border-b bg-white px-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="size-[1.875rem]" />
          <span className="font-display text-brand-950 text-[17px] font-bold tracking-[-0.01em]">
            {BRAND.companyName}
          </span>
        </Link>
        <a
          href={BRAND.phoneHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <Phone className="size-4 text-slate-500" aria-hidden="true" />
          {BRAND.phone}
        </a>
      </header>

      <main className="flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex w-full max-w-[48.75rem] flex-col gap-4">
          {children}
        </div>
      </main>
    </div>
  );
}
