import { UserRole } from "@/generated/prisma/enums";

const ROLE_VALUES: readonly string[] = Object.values(UserRole);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && ROLE_VALUES.includes(value);
}

export const LEAST_PRIVILEGED_ROLE: UserRole = UserRole.OPERATOR;

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  REVIEWER: "Reviewer",
  OPERATOR: "Operator",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Full access, including franchise locations and API credentials.",
  REVIEWER: "Reviews, approves and sends draft estimates.",
  OPERATOR: "Monitors intake sessions and follows up on callbacks.",
};
