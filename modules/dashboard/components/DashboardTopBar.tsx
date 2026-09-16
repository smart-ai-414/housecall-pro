"use client";

import { AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";

import { DASHBOARD_NAV } from "@/core/config/navigation";

function titleForPath(pathname: string): string {
  const match = [...DASHBOARD_NAV]
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.label ?? "Dashboard";
}

export function DashboardTopBar() {
  const pathname = usePathname();

  return (
    <div className="border-border-subtle flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-white px-5 sm:px-7">
      <span className="font-display text-brand-950 text-[17px] font-semibold tracking-[-0.01em]">
        {titleForPath(pathname)}
      </span>

      <span className="inline-flex h-8 items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 text-[12.5px] font-semibold text-amber-800">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">
          Writing to the live Housecall Pro account
        </span>
        <span className="sm:hidden">Live account</span>
      </span>
    </div>
  );
}
