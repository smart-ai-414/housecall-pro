"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ActionResult } from "@/core/errors";
import { signInWithCredentials } from "@/modules/auth/actions";

type SignInState = ActionResult<never> | null;

async function submit(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  return signInWithCredentials(formData);
}

export function SignInForm({
  callbackUrl,
  registeredEmail,
}: {
  callbackUrl: string;
  registeredEmail?: string;
}) {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    submit,
    null,
  );

  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError =
    state && !state.ok && !state.error.fieldErrors ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {registeredEmail ? (
        <Alert tone="success" title="Account created">
          Sign in as {registeredEmail} to continue.
        </Alert>
      ) : null}

      {formError ? <Alert tone="error">{formError}</Alert> : null}

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
          defaultValue={registeredEmail}
          required
          autoFocus
          invalid={Boolean(fieldErrors?.email)}
        />
      </Field>

      <Field
        htmlFor="password"
        label="Password"
        required
        errors={fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(fieldErrors?.password)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Have an invite code?{" "}
        <Link
          href="/auth/signup"
          className="text-brand-700 font-medium hover:underline"
        >
          Create your account
        </Link>
      </p>
    </form>
  );
}
