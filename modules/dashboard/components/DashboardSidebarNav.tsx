"use client";

import {
  Building2,
  FileCheck2,
  LayoutDashboard,
  MessagesSquare,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/core/utils/cn";
import type {
  DashboardIconName,
  DashboardNavItem,
} from "@/core/config/navigation";

const ICONS: Record<DashboardIconName, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  sessions: MessagesSquare,
  estimates: FileCheck2,
  locations: Building2,
  settings: Settings,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebarNav({
  items,
}: {
  items: readonly DashboardNavItem[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard sections" className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.iconName];
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-800"
                : "hover:bg-surface-sunken text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-brand-700" : "text-slate-400",
              )}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
