import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Single Prisma client for the whole app. In dev, Next.js hot-reloads modules,
// which would otherwise spawn a new client (and connection pool) on every reload;
// caching it on globalThis avoids exhausting Postgres connections.
//
// Prisma 7 connects through a driver adapter. The connection URL is read from
// DATABASE_URL here so hosting stays a single-env-var change.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
