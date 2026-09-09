"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { signOutStaff } from "@/modules/auth/sign-out-action";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => signOutStaff())}
      className="hover:bg-surface-sunken flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
    >
      <LogOut className="size-4 text-slate-400" aria-hidden="true" />
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
