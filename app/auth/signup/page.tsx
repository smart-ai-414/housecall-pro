import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/authz";
import { SignUpForm } from "@/modules/auth/components/SignUpForm";

export const metadata: Metadata = {
  title: "Create a staff account",
};

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-brand-950 text-[1.625rem] font-bold tracking-[-0.018em]">
          Create your account
        </h1>
        <p className="text-[14.5px] leading-6 text-slate-600">
          You need an invite code from an administrator. Your code decides what
          you can see.
        </p>
      </div>

      <SignUpForm />
    </div>
  );
}
