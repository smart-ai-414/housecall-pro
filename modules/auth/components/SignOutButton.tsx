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
      className="text-brand-300 flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium hover:bg-white/5 hover:text-white disabled:opacity-60"
    >
      <LogOut className="size-4 shrink-0" aria-hidden="true" />
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
