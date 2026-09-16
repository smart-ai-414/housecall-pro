import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";
import { BrandMark } from "@/modules/marketing/components/BrandMark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-sunken flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <div className="border-border-strong shadow-md grid w-full max-w-[41.25rem] overflow-hidden rounded-2xl border bg-white lg:grid-cols-[15.625rem_1fr]">
        <div className="bg-ink relative hidden flex-col justify-between overflow-hidden p-8 lg:flex">
          <div
            aria-hidden="true"
            className="border-ink-line absolute -bottom-15 -left-15 size-60 rotate-[18deg] border"
          />
          <Link href="/" className="relative flex items-center gap-2.5">
            <BrandMark className="size-[1.875rem]" />
            <span className="font-display text-[17px] font-bold text-white">
              {BRAND.companyName}
            </span>
          </Link>
          <div className="relative flex flex-col gap-3">
            <p className="font-display text-xl leading-7 font-semibold tracking-[-0.012em] text-white">
              The review queue lives here.
            </p>
            <p className="text-brand-300 text-[13.5px] leading-[22px]">
              Pricing and sending still happen inside Housecall Pro.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-6 p-7 sm:p-11">
          <Link href="/" className="flex items-center gap-2.5 lg:hidden">
            <BrandMark className="size-7" />
            <span className="font-display text-brand-950 text-base font-bold">
              {BRAND.companyName}
            </span>
          </Link>

          {children}

          <p className="border-t border-slate-100 pt-5 text-[12.5px] leading-5 text-slate-400">
            Staff access only. Customers never need an account to request an
            estimate.
          </p>
        </div>
      </div>
    </div>
  );
}
