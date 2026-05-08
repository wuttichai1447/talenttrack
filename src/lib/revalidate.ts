import { revalidatePath } from "next/cache";

/**
 * Invalidate every route that reads candidate / interview / pipeline data.
 *
 * Without this, mutations on `/api/*` routes can leave Server-rendered pages
 * showing stale data — even when those pages declare `dynamic = "force-dynamic"`,
 * the Vercel data layer may return cached `prisma.findMany()` results until the
 * Router Cache is explicitly invalidated.
 *
 * Call this at the end of every POST / PATCH / DELETE that touches
 * candidates, interviews, screenings, or stage events.
 */
export function revalidatePipeline() {
  revalidatePath("/");
  revalidatePath("/candidates");
  revalidatePath("/interviews");
  revalidatePath("/candidates/[id]", "page");
}
