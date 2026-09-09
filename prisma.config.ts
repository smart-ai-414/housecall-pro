import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

loadEnv({ path: ".env", quiet: true });

const directUrl = process.env.DIRECT_DATABASE_URL
  ? env("DIRECT_DATABASE_URL")
  : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    ...(directUrl ? { directUrl } : {}),
  },
});
