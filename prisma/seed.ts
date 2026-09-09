import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../generated/prisma/client";

loadEnv({ path: ".env", quiet: true });

const BCRYPT_COST = 12;

const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? "admin@clearviewglass.example";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "glassbot-dev-admin";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Dev Administrator";

const FRANCHISE_LOCATIONS = [
  {
    name: "[TEST] North Metro",
    slug: "north-metro",
    zipCodes: ["55401", "55402", "55403", "55404", "55405"],
    priceBookId: "PLACEHOLDER_PRICE_BOOK_NORTH",
  },
  {
    name: "[TEST] South Metro",
    slug: "south-metro",
    zipCodes: ["55420", "55423", "55425", "55431"],
    priceBookId: "PLACEHOLDER_PRICE_BOOK_SOUTH",
  },
  {
    name: "[TEST] West Suburbs",
    slug: "west-suburbs",
    zipCodes: ["55305", "55343", "55345", "55391"],
    priceBookId: "PLACEHOLDER_PRICE_BOOK_WEST",
  },
] as const;

const INVITE_CODES = [
  {
    code: "GLASSBOT-ADMIN",
    grantsRole: "ADMIN" as const,
    maxUses: 3,
    note: "Development administrator invites",
  },
  {
    code: "GLASSBOT-REVIEWER",
    grantsRole: "REVIEWER" as const,
    maxUses: 10,
    note: "Estimate reviewers",
  },
  {
    code: "GLASSBOT-OPERATOR",
    grantsRole: "OPERATOR" as const,
    maxUses: 10,
    note: "Intake operators",
  },
] as const;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and set it before seeding.",
    );
  }
  return url;
}

function generateEncryptionKeyHint(): string {
  return randomBytes(32).toString("base64");
}

async function main() {
  const adapter = new PrismaPg({ connectionString: requireDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST);

    const admin = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { name: ADMIN_NAME, role: "ADMIN" },
      create: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: "ADMIN",
        passwordHash,
      },
      select: { id: true, email: true },
    });

    for (const invite of INVITE_CODES) {
      await prisma.inviteCode.upsert({
        where: { code: invite.code },
        update: {
          grantsRole: invite.grantsRole,
          maxUses: invite.maxUses,
          note: invite.note,
          isActive: true,
        },
        create: {
          code: invite.code,
          grantsRole: invite.grantsRole,
          maxUses: invite.maxUses,
          note: invite.note,
        },
      });
    }

    for (const location of FRANCHISE_LOCATIONS) {
      await prisma.franchiseLocation.upsert({
        where: { slug: location.slug },
        update: {
          name: location.name,
          territoryDefinition: {
            zipCodes: [...location.zipCodes],
            geoBoundary: null,
          },
          priceBookId: location.priceBookId,
          isActive: true,
        },
        create: {
          name: location.name,
          slug: location.slug,
          territoryDefinition: {
            zipCodes: [...location.zipCodes],
            geoBoundary: null,
          },
          priceBookId: location.priceBookId,
          isActive: true,
        },
      });
    }

    const counts = {
      users: await prisma.user.count(),
      inviteCodes: await prisma.inviteCode.count(),
      locations: await prisma.franchiseLocation.count(),
    };

    console.log("Seed complete.");
    console.log("");
    console.log(`  Admin sign-in:  ${admin.email}`);
    console.log(`  Admin password: ${ADMIN_PASSWORD}`);
    console.log("");
    console.log("  Invite codes:");
    for (const invite of INVITE_CODES) {
      console.log(
        `    ${invite.code.padEnd(20)} grants ${invite.grantsRole} (${invite.maxUses} uses)`,
      );
    }
    console.log("");
    console.log(
      `  ${counts.users} users, ${counts.inviteCodes} invite codes, ${counts.locations} locations`,
    );
    console.log("");
    console.log(
      "  Locations carry the [TEST] prefix. Housecall Pro has no sandbox, so",
    );
    console.log(
      "  anything these locations write must stay identifiable as test data.",
    );
    console.log("");
    console.log(
      `  Need an ENCRYPTION_KEY? Here is a fresh one: ${generateEncryptionKeyHint()}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
