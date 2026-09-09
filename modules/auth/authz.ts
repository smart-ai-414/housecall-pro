import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { accessDeniedPathForRole } from "@/core/config/navigation";
import { auth } from "@/modules/auth/auth";
import { AppError } from "@/core/errors";
import type { UserRole } from "@/generated/prisma/enums";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

async function readSessionTolerantly() {
  try {
    return await auth();
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;

    console.warn(
      "[auth] Discarding an unreadable session cookie and treating this request as signed out. " +
        "This happens when AUTH_SECRET changed, or when another application on the same " +
        "host set a cookie of the same name (browsers ignore the port, so every localhost " +
        "project shares cookies).",
      error.message,
    );

    return null;
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await readSessionTolerantly();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");
  return user;
}

export async function requireRole(
  ...allowedRoles: readonly UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireUser();

  if (!allowedRoles.includes(user.role)) {
    redirect(accessDeniedPathForRole(user.role));
  }

  return user;
}

export async function requireUserForAction(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Please sign in and try again.");
  }
  return user;
}

export async function requireRoleForAction(
  ...allowedRoles: readonly UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireUserForAction();
  if (!allowedRoles.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Your role does not permit this action.");
  }
  return user;
}

export const isAdmin = (user: AuthenticatedUser) => user.role === "ADMIN";

export const canReviewEstimates = (user: AuthenticatedUser) =>
  user.role === "ADMIN" || user.role === "REVIEWER";
