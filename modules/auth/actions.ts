"use server";

import { AuthError } from "next-auth";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/core/db/prisma";
import {
  actionError,
  actionOk,
  type ActionResult,
  validationError,
  withActionErrorHandling,
} from "@/core/errors";
import { hashPassword, signIn } from "@/modules/auth/auth";
import { signInSchema, signUpSchema } from "@/modules/auth/schemas";

const DEFAULT_SIGNED_IN_PATH = "/dashboard";

const INVALID_CREDENTIALS_MESSAGE =
  "Those credentials do not match an account.";

const GENERIC_INVITE_ERROR =
  "That invite code is not valid. Ask an administrator for a new one.";

export async function registerStaffAccount(
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  return withActionErrorHandling("registerStaffAccount", async () => {
    const parsed = signUpSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      inviteCode: formData.get("inviteCode"),
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, email, password, inviteCode } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const email_created = await prisma.$transaction(async (tx) => {
        const invite = await tx.inviteCode.findUnique({
          where: { code: inviteCode },
        });

        const isRedeemable =
          invite !== null &&
          invite.isActive &&
          invite.useCount < invite.maxUses &&
          (invite.expiresAt === null || invite.expiresAt > new Date());

        if (!invite || !isRedeemable) {
          throw new InviteRejectedError();
        }

        const consumed = await tx.inviteCode.updateMany({
          where: {
            id: invite.id,
            isActive: true,
            useCount: invite.useCount,
          },
          data: { useCount: { increment: 1 } },
        });

        if (consumed.count !== 1) {
          throw new InviteRejectedError();
        }

        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: invite.grantsRole,
            inviteCodeId: invite.id,
          },
          select: { email: true },
        });

        return user.email;
      });

      return actionOk({ email: email_created });
    } catch (error) {
      if (error instanceof InviteRejectedError) {
        return actionError("FORBIDDEN", GENERIC_INVITE_ERROR, {
          inviteCode: [GENERIC_INVITE_ERROR],
        });
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return actionError(
          "CONFLICT",
          "An account with that email already exists.",
          { email: ["An account with that email already exists."] },
        );
      }

      throw error;
    }
  });
}

class InviteRejectedError extends Error {
  constructor() {
    super("Invite code rejected");
    this.name = "InviteRejectedError";
  }
}

function safeCallbackUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0)
    return DEFAULT_SIGNED_IN_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_SIGNED_IN_PATH;
  }
  return raw;
}

export async function signInWithCredentials(
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return actionError("UNAUTHENTICATED", INVALID_CREDENTIALS_MESSAGE);
    }
    throw error;
  }

  return actionError("INTERNAL_ERROR", "Sign-in did not complete.");
}
