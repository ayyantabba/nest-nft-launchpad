import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
try {
  const [tables] = await db.$queryRawUnsafe(
    `SELECT to_regclass('"Collection"')::text AS "collectionTable",
            to_regclass('"_prisma_migrations"')::text AS "migrationTable"`
  );

  if (tables?.collectionTable) {
    let initialApplied = false;
    if (tables.migrationTable) {
      const rows = await db.$queryRawUnsafe(
        `SELECT 1 FROM "_prisma_migrations"
          WHERE migration_name = '20260714000000_init' AND finished_at IS NOT NULL
          LIMIT 1`
      );
      initialApplied = rows.length > 0;
    }

    if (!initialApplied) {
      await db.$disconnect();
      execFileSync(process.execPath, [
        "node_modules/prisma/build/index.js",
        "migrate",
        "resolve",
        "--applied",
        "20260714000000_init"
      ], { stdio: "inherit", env: process.env });
    }
  }
} finally {
  await db.$disconnect();
}

execFileSync(process.execPath, [
  "node_modules/prisma/build/index.js",
  "migrate",
  "deploy"
], { stdio: "inherit", env: process.env });
