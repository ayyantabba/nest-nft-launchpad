import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var nestPrisma: PrismaClient | undefined;
}

export const db = globalThis.nestPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.nestPrisma = db;
