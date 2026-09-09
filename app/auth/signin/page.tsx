import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/modules/auth/authz";
import { SignInForm } from "@/modules/auth/components/SignInForm";

export const metadata: Metadata = {
  title: "Staff sign in",
};

const DEFAULT_CALLBACK_URL = "/dashboard";

function toRelativePath(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    return DEFAULT_CALLBACK_URL;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_CALLBACK_URL;
  }
  return value;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(DEFAULT_CALLBACK_URL);

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Sign in
        </h1>
        <p className="text-sm text-slate-600">
          Review the intake queue and approve draft estimates.
        </p>
      </div>

      <SignInForm
        callbackUrl={toRelativePath(params.callbackUrl)}
        registeredEmail={firstValue(params.registered)}
      />
    </div>
  );
}
