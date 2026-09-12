import { NextResponse } from "next/server";

import { prisma } from "@/core/db/prisma";
import { verifyPhotoAccessToken } from "@/core/security/photo-access-token";
import { createSignedReadUrl } from "@/modules/photos/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK_NOT_VALID =
  "This photo link is not valid. Open the estimate in Housecall Pro and ask the office to resend it.";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const verified = verifyPhotoAccessToken(decodeURIComponent(token));

  if (!verified) {
    return new NextResponse(LINK_NOT_VALID, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const photo = await prisma.sessionPhoto.findUnique({
    where: { id: verified.photoId },
    select: { storageKey: true },
  });

  if (!photo) {
    return new NextResponse(LINK_NOT_VALID, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const signedUrl = await createSignedReadUrl(photo.storageKey);

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}
