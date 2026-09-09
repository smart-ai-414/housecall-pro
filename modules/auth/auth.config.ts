import type { NextAuthConfig } from "next-auth";

import { isUserRole, LEAST_PRIVILEGED_ROLE } from "@/modules/auth/roles";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const UNREADABLE_SESSION_ERRORS = new Set([
  "JWTSessionError",
  "SessionTokenError",
]);

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },

  trustHost: true,

  logger: {
    error(error: Error) {
      if (UNREADABLE_SESSION_ERRORS.has(error.name)) {
        console.warn(
          `[auth] Ignoring an unreadable session cookie (${error.name}). The request is treated as signed out and the cookie is cleared.`,
        );
        return;
      }
      console.error(error);
    },
  },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const id = readString(user.id);
        if (id) token.id = id;

        token.role = isUserRole(user.role) ? user.role : LEAST_PRIVILEGED_ROLE;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = readString(token.id) ?? readString(token.sub) ?? "";
        session.user.role = isUserRole(token.role)
          ? token.role
          : LEAST_PRIVILEGED_ROLE;
      }
      return session;
    },
  },

  providers: [],
} satisfies NextAuthConfig;
