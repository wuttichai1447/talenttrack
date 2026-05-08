/**
 * Server-side PDF text extraction using `unpdf`.
 *
 * Why unpdf instead of pdfjs-dist:
 * - pdfjs-dist insists on initialising a Web Worker even in Node, and on
 *   Vercel's serverless runtime the "fake worker" fallback fails with
 *   `Setting up fake worker failed: "No 'GlobalWorkerOptions.workerSrc' specified."`.
 * - unpdf is a small wrapper (by the Nuxt team) that ships a pre-built
 *   pdfjs without the worker dependency, designed specifically for
 *   serverless / edge runtimes.
 * - Same parsing engine, no worker headaches.
 */
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(buffer: ArrayBuffer | Buffer): Promise<string> {
  const data =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
