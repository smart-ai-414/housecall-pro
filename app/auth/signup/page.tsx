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
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="text-sm text-slate-600">
          You need an invite code from an administrator. Your code decides what
          you can see.
        </p>
      </div>

      <SignUpForm />
    </div>
  );
}
