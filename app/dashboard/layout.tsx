import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/core/config/branding";
import { visibleNavItems } from "@/core/config/navigation";
import { requireUser } from "@/modules/auth/authz";
import { SignOutButton } from "@/modules/auth/components/SignOutButton";
import { ROLE_LABELS } from "@/modules/auth/roles";
import { DashboardSidebarNav } from "@/modules/dashboard/components/DashboardSidebarNav";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const navItems = visibleNavItems(user.role);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-border-subtle flex shrink-0 flex-col gap-6 border-b bg-white px-4 py-5 lg:w-64 lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <span
            className="bg-brand-700 flex size-8 items-center justify-center rounded-md text-sm font-bold text-white"
            aria-hidden="true"
          >
            {BRAND.companyShortName.charAt(0)}
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            {BRAND.productName}
          </span>
        </Link>

        <DashboardSidebarNav items={navItems} />

        <div className="border-border-subtle mt-auto space-y-3 border-t pt-4">
          <div className="px-3">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name || user.email}
            </p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="bg-surface-muted flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
