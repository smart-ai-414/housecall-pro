import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-muted flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
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

        <div className="ring-border-subtle rounded-xl bg-white p-8 ring-1">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Staff access only. Customers do not need an account to request an
          estimate.
        </p>
      </div>
    </div>
  );
}
