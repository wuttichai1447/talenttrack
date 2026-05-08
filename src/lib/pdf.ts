/**
 * Server-side PDF text extraction using pdfjs-dist (legacy build for Node).
 *
 * Why pdfjs-dist over pdf-parse:
 * - pdf-parse ships pdfjs as bundled assets with very deep file paths that hit
 *   Windows MAX_PATH limits during npm install on some setups.
 * - pdfjs-dist is the upstream library, actively maintained, and works in
 *   Node via its `legacy/build/pdf.mjs` entry point.
 */

// Tell pdfjs not to load worker from a separate file (we run in Node)
type PdfDocItem = { str?: string };

export async function extractPdfText(buffer: ArrayBuffer | Buffer): Promise<string> {
  // Dynamic import so this code path only loads on the server when needed
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Disable worker — we run in a single Node thread (pdfjs-dist 4.x)
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const data =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as PdfDocItem[])
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(pageText);
  }
  await doc.destroy();
  return pages.join("\n\n");
}
