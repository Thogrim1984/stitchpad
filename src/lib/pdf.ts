import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

declare global {
  interface Window {
    __STITCHPAD_DEBUG?: boolean;
    __pdfWorkerPath?: string;
  }
}

const resolvedWorkerSrc =
  (typeof window !== 'undefined' && window.__pdfWorkerPath) ||
  (workerSrc as unknown as string);

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = resolvedWorkerSrc;
  if (typeof window !== 'undefined' && window.__STITCHPAD_DEBUG === true) {
    console.debug('[StitchPad] Using pdf.js worker source:', resolvedWorkerSrc);
  }
}

export type LoadedPdf = {
  doc: PDFDocumentProxy;
  data: ArrayBuffer;
};

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const data = await file.arrayBuffer();
  const loadingTask = getDocument({ data });
  const doc = await loadingTask.promise;
  return { doc, data };
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable');
  }

  const renderTask = page.render({
    canvasContext: context,
    viewport,
  } as Parameters<typeof page.render>[0]);
  await renderTask.promise;
}

export async function resolveFingerprint(
  doc: PDFDocumentProxy,
  fallbackSource: ArrayBuffer,
): Promise<string> {
  const [primary, secondary] = doc.fingerprints ?? [];
  if (primary) return primary;
  if (secondary) return secondary;
  const hash = await hashBuffer(fallbackSource);
  return hash;
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}
