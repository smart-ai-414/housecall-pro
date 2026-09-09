import NextAuth, { AuthError } from "next-auth";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

import {
  accessDeniedPathForRole,
  canAccessDashboardPath,
} from "@/core/config/navigation";
import { authConfig } from "@/modules/auth/auth.config";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

const { auth } = NextAuth(authConfig);

function signInRedirect(request: NextRequest): NextResponse {
  const { nextUrl } = request;
  const signInUrl = new URL("/auth/signin", nextUrl.origin);

  signInUrl.searchParams.set(
    "callbackUrl",
    `${nextUrl.pathname}${nextUrl.search}`,
  );

  return NextResponse.redirect(signInUrl);
}

const authorizeDashboard = auth((request) => {
  const user = request.auth?.user;

  if (!user) {
    return signInRedirect(request as unknown as NextRequest);
  }

  if (!canAccessDashboardPath(request.nextUrl.pathname, user.role)) {
    return NextResponse.redirect(
      new URL(accessDeniedPathForRole(user.role), request.nextUrl.origin),
    );
  }

  return NextResponse.next();
});

type MiddlewareHandler = (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response | undefined>;

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  try {
    const response = await (authorizeDashboard as unknown as MiddlewareHandler)(
      request,
      event,
    );
    return response ?? NextResponse.next();
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;

    console.warn(
      "[auth] Could not read the session cookie in proxy; clearing it and sending the request to sign in.",
      error.message,
    );

    const response = signInRedirect(request);

    for (const name of SESSION_COOKIE_NAMES) {
      response.cookies.delete(name);
    }

    return response;
  }
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
