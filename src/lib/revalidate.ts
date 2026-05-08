import { revalidatePath } from "next/cache";

/**
 * Invalidate every route that reads candidate / interview / pipeline data.
 *
 * Without this, mutations on `/api/*` routes can leave Server-rendered pages
 * showing stale data — even when those pages declare `dynamic = "force-dynamic"`,
 * the Vercel data layer may return cached `prisma.findMany()` results until the
 * Router Cache is explicitly invalidated.
 *
 * Wrapped in try/catch so a transient revalidation hiccup (e.g. during a
 * rolling deploy on Vercel) can never sink the underlying mutation response —
 * the worst case is one request showing slightly stale data, which the user
 * will refresh away. Better than returning 500 after a successful DB write.
 *
 * Call this at the end of every POST / PATCH / DELETE that touches
 * candidates, interviews, screenings, or stage events.
 */
export function revalidatePipeline() {
  const paths: Array<[string] | [string, "page" | "layout"]> = [
    ["/"],
    ["/candidates"],
    ["/interviews"],
    ["/candidates/[id]", "page"],
  ];
  for (const args of paths) {
    try {
      // @ts-expect-error — tuple spread to accommodate both 1- and 2-arg forms
      revalidatePath(...args);
    } catch (err) {
      console.warn("[revalidatePipeline] failed for", args[0], err);
    }
  }
}
