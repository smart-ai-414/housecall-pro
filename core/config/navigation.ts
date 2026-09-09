import type { UserRole } from "@/generated/prisma/enums";

export type DashboardIconName =
  "overview" | "sessions" | "estimates" | "locations" | "settings";

export interface DashboardNavItem {
  label: string;
  href: string;
  iconName: DashboardIconName;
  description: string;
  allowedRoles: readonly UserRole[];
}

const ALL_ROLES = ["ADMIN", "REVIEWER", "OPERATOR"] as const;

export const DASHBOARD_NAV: readonly DashboardNavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    iconName: "overview",
    description: "Intake volume and review backlog at a glance",
    allowedRoles: ALL_ROLES,
  },
  {
    label: "Sessions",
    href: "/dashboard/sessions",
    iconName: "sessions",
    description: "Every customer conversation, live and abandoned",
    allowedRoles: ALL_ROLES,
  },
  {
    label: "Estimates",
    href: "/dashboard/estimates",
    iconName: "estimates",

    description: "Draft estimates awaiting human approval",
    allowedRoles: ["ADMIN", "REVIEWER"],
  },
  {
    label: "Locations",
    href: "/dashboard/locations",
    iconName: "locations",
    description: "Franchise territories and price book mapping",
    allowedRoles: ["ADMIN"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    iconName: "settings",

    description: "Housecall Pro credentials and intake configuration",
    allowedRoles: ["ADMIN"],
  },
] as const;

export function visibleNavItems(role: UserRole): DashboardNavItem[] {
  return DASHBOARD_NAV.filter((item) => item.allowedRoles.includes(role));
}

export function canAccessDashboardPath(
  pathname: string,
  role: UserRole,
): boolean {
  const match = [...DASHBOARD_NAV]
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!match) return true;
  return match.allowedRoles.includes(role);
}

export function fallbackPathForRole(role: UserRole): string {
  return visibleNavItems(role)[0]?.href ?? "/dashboard";
}

export const ACCESS_DENIED_PARAM = "denied";

export function accessDeniedPathForRole(role: UserRole): string {
  return `${fallbackPathForRole(role)}?${ACCESS_DENIED_PARAM}=1`;
}
