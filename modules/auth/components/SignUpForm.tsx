"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ActionResult } from "@/core/errors";
import { registerStaffAccount } from "@/modules/auth/actions";

type SignUpState = ActionResult<{ email: string }> | null;

async function submit(
  _previous: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  return registerStaffAccount(formData);
}

export function SignUpForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    submit,
    null,
  );

  const registeredEmail = state?.ok ? state.data.email : null;

  useEffect(() => {
    if (!registeredEmail) return;
    const timer = setTimeout(() => {
      router.push(
        `/auth/signin?registered=${encodeURIComponent(registeredEmail)}`,
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [registeredEmail, router]);

  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError =
    state && !state.ok && !state.error.fieldErrors ? state.error.message : null;

  if (registeredEmail) {
    return (
      <Alert tone="success" title="Account created">
        Signing you in as {registeredEmail}…
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field
        htmlFor="name"
        label="Full name"
        required
        errors={fieldErrors?.name}
      >
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          invalid={Boolean(fieldErrors?.name)}
        />
      </Field>

      <Field
        htmlFor="email"
        label="Work email"
        required
        errors={fieldErrors?.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          invalid={Boolean(fieldErrors?.email)}
        />
      </Field>

      <Field
        htmlFor="password"
        label="Password"
        hint="At least 8 characters. Length matters more than symbols."
        required
        errors={fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          invalid={Boolean(fieldErrors?.password)}
        />
      </Field>

      <Field
        htmlFor="inviteCode"
        label="Invite code"
        hint="Registration is closed. An administrator issues these."
        required
        errors={fieldErrors?.inviteCode}
      >
        <Input
          id="inviteCode"
          name="inviteCode"
          type="text"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase"
          required
          invalid={Boolean(fieldErrors?.inviteCode)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href="/auth/signin"
          className="text-brand-700 font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
