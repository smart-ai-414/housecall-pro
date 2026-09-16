import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";
import { visibleNavItems } from "@/core/config/navigation";
import { requireUser } from "@/modules/auth/authz";
import { SignOutButton } from "@/modules/auth/components/SignOutButton";
import { ROLE_LABELS } from "@/modules/auth/roles";
import { DashboardSidebarNav } from "@/modules/dashboard/components/DashboardSidebarNav";
import { DashboardTopBar } from "@/modules/dashboard/components/DashboardTopBar";
import { BrandMark } from "@/modules/marketing/components/BrandMark";

function initialsOf(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const navItems = visibleNavItems(user.role);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="bg-ink flex shrink-0 flex-col gap-5 px-3.5 py-5 lg:w-62">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <BrandMark className="size-[1.875rem]" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[15.5px] font-bold text-white">
              {BRAND.companyName}
            </span>
            <span className="text-ink-muted text-[10.5px] tracking-[0.08em] uppercase">
              {BRAND.productName}
            </span>
          </span>
        </Link>

        <DashboardSidebarNav items={navItems} />

        <div className="border-ink-line mt-auto hidden flex-col gap-3 border-t pt-3.5 lg:flex">
          <div className="flex items-center gap-2.5">
            <span className="bg-brand-700 text-brand-200 flex size-8.5 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold">
              {initialsOf(user.name, user.email)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13.5px] font-semibold text-white">
                {user.name || user.email}
              </span>
              <span className="text-ink-muted text-[11.5px]">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="bg-surface-sunken flex min-w-0 flex-1 flex-col">
        <DashboardTopBar />
        <main className="flex-1 px-5 py-6 sm:px-7">
          <div className="mx-auto max-w-[76rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
