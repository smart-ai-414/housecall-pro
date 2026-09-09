"use server";

import { signOut } from "@/modules/auth/auth";

export async function signOutStaff(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
