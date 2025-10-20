import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdf, resolveFingerprint } from '../lib/pdf';

type PdfHookState = {
  doc: PDFDocumentProxy | null;
  fingerprint: string | null;
  loading: boolean;
  error: Error | null;
};

export function usePdf(file: File | null): PdfHookState {
  const [state, setState] = useState<PdfHookState>({
    doc: null,
    fingerprint: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let currentDoc: PDFDocumentProxy | null = null;

    if (!file) {
      setState({
        doc: null,
        fingerprint: null,
        loading: false,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    loadPdf(file)
      .then(async ({ doc, data }) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        currentDoc = doc;
        const fingerprint = await resolveFingerprint(doc, data);
        if (cancelled) {
          doc.destroy();
          return;
        }
        setState({
          doc,
          fingerprint,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          doc: null,
          fingerprint: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    return () => {
      cancelled = true;
      if (currentDoc) {
        currentDoc.destroy();
      }
    };
  }, [file]);

  return state;
}
