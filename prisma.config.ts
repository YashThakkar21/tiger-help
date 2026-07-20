import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma into this config file.
// The URL still comes from DATABASE_URL in .env, so switching hosts stays a
// one-line config change — no code touches the connection directly.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
