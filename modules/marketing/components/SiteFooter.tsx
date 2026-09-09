import Link from "next/link";

import { BRAND } from "@/core/config/branding";

export function SiteFooter() {
  return (
    <footer className="border-border-subtle mt-auto border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="font-semibold text-slate-900">{BRAND.legalName}</p>
          <p className="text-sm text-slate-600">{BRAND.tagline}</p>
          <p className="text-sm text-slate-500">
            Serving the metro area since {BRAND.foundedYear}.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-semibold text-slate-900">Contact</p>
          <p>
            <a
              href={BRAND.phoneHref}
              className="text-brand-700 hover:underline"
            >
              {BRAND.phone}
            </a>
          </p>
          <p>
            <a
              href={`mailto:${BRAND.email}`}
              className="text-brand-700 hover:underline"
            >
              {BRAND.email}
            </a>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-semibold text-slate-900">Team</p>
          <p>
            <Link
              href="/auth/signin"
              className="hover:text-brand-700 text-slate-600 hover:underline"
            >
              Staff login
            </Link>
          </p>
          <p>
            <Link
              href="/auth/signup"
              className="hover:text-brand-700 text-slate-600 hover:underline"
            >
              Redeem an invite
            </Link>
          </p>
        </div>
      </div>

      <div className="border-border-subtle border-t px-6 py-4">
        <p className="mx-auto max-w-6xl text-xs text-slate-500">
          Estimates are prepared by {BRAND.companyName} staff. Figures shown
          during intake are measurements, not prices.
        </p>
      </div>
    </footer>
  );
}
