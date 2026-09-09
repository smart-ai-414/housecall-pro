"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/core/db/prisma";
import {
  actionError,
  actionOk,
  type ActionResult,
  validationError,
  withActionErrorHandling,
} from "@/core/errors";
import { encryptSecret } from "@/core/security/encryption";
import { Prisma } from "@/generated/prisma/client";
import { requireRoleForAction } from "@/modules/auth/authz";
import {
  franchiseLocationFormSchema,
  locationApiKeySchema,
} from "@/modules/tenancy/schemas";

const LOCATIONS_PATH = "/dashboard/locations";
const SETTINGS_PATH = "/dashboard/settings";

function readFormFields(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    zipCodes: formData.get("zipCodes") ?? "",
    housecallProAccountId: formData.get("housecallProAccountId") ?? "",
    priceBookId: formData.get("priceBookId") ?? "",
    isActive: formData.get("isActive") === "on",
  };
}

export async function saveFranchiseLocation(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withActionErrorHandling("saveFranchiseLocation", async () => {
    await requireRoleForAction("ADMIN");

    const parsed = franchiseLocationFormSchema.safeParse(
      readFormFields(formData),
    );

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const locationId = formData.get("locationId");
    const territoryDefinition = {
      zipCodes: parsed.data.zipCodes,
      geoBoundary: null,
    };

    const data = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      territoryDefinition,
      housecallProAccountId: parsed.data.housecallProAccountId,
      priceBookId: parsed.data.priceBookId,
      isActive: parsed.data.isActive,
    };

    try {
      const saved =
        typeof locationId === "string" && locationId.length > 0
          ? await prisma.franchiseLocation.update({
              where: { id: locationId },
              data,
              select: { id: true },
            })
          : await prisma.franchiseLocation.create({
              data,
              select: { id: true },
            });

      revalidatePath(LOCATIONS_PATH);
      revalidatePath(SETTINGS_PATH);

      return actionOk({ id: saved.id });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return actionError(
          "CONFLICT",
          "Another location already uses that slug.",
          { slug: ["Another location already uses that slug."] },
        );
      }
      throw error;
    }
  });
}

export async function saveLocationApiKey(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withActionErrorHandling("saveLocationApiKey", async () => {
    await requireRoleForAction("ADMIN");

    const parsed = locationApiKeySchema.safeParse({
      locationId: formData.get("locationId"),
      apiKey: formData.get("apiKey"),
    });

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const updated = await prisma.franchiseLocation.update({
      where: { id: parsed.data.locationId },
      data: { apiKeyEncrypted: encryptSecret(parsed.data.apiKey) },
      select: { id: true },
    });

    revalidatePath(SETTINGS_PATH);
    revalidatePath(LOCATIONS_PATH);

    return actionOk({ id: updated.id });
  });
}

export async function clearLocationApiKey(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withActionErrorHandling("clearLocationApiKey", async () => {
    await requireRoleForAction("ADMIN");

    const locationId = formData.get("locationId");
    if (typeof locationId !== "string" || locationId.length === 0) {
      return actionError("VALIDATION_FAILED", "Select a location first.");
    }

    const updated = await prisma.franchiseLocation.update({
      where: { id: locationId },
      data: { apiKeyEncrypted: null },
      select: { id: true },
    });

    revalidatePath(SETTINGS_PATH);
    revalidatePath(LOCATIONS_PATH);

    return actionOk({ id: updated.id });
  });
}
