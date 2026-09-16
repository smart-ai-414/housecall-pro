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
    <nav aria-label="Dashboard">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const Icon = ICONS[item.iconName];
          const active = isActive(pathname, item.href);

          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.description}
                className={cn(
                  "flex h-10.5 items-center gap-3 rounded-lg px-3 text-[14.5px] whitespace-nowrap transition-colors",
                  active
                    ? "bg-brand-800 font-semibold text-white"
                    : "text-brand-300 font-medium hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
