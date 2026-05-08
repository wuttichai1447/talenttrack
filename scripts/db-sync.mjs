/**
 * Run `prisma db push` only when a real Postgres URL is available.
 *
 * Why this exists:
 * - On Vercel, the *first* deploy happens before the user has connected
 *   a Neon database. If we hard-required `prisma db push` in the build
 *   step, that first deploy would always fail with a confusing error.
 * - Once Neon is added (Vercel marketplace one-click), DATABASE_URL is
 *   injected and every subsequent deploy runs the schema sync, which is
 *   idempotent.
 * - During pure local dev with SQLite (`file:./dev.db`), we also skip,
 *   because `pnpm db:push` is the explicit local workflow.
 */
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";

if (!url) {
  console.log("⚠ DATABASE_URL not set — skipping `prisma db push`. Connect Neon (or set DATABASE_URL) and redeploy to sync the schema.");
  process.exit(0);
}

if (url.startsWith("file:")) {
  console.log("ℹ DATABASE_URL points at SQLite — skipping `prisma db push` here (use `pnpm db:push` locally).");
  process.exit(0);
}

console.log("→ Running `prisma db push` against the configured database…");
try {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  console.error("✗ `prisma db push` failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
