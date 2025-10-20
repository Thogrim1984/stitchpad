import { useCallback } from 'react';
import type { ChangeEvent } from 'react';

type PdfLoaderProps = {
  fileName?: string;
  loading: boolean;
  error: Error | null;
  onSelectFile: (file: File | null) => void;
  fingerprint?: string | null;
  pageCount?: number;
};

export function PdfLoader({
  fileName,
  loading,
  error,
  fingerprint,
  pageCount,
  onSelectFile,
}: PdfLoaderProps) {
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null;
      onSelectFile(nextFile);
      // Allow selecting the same file again
      event.target.value = '';
    },
    [onSelectFile],
  );

  return (
    <div className="panel">
      <h2>PDF laden</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={loading}
      />
      <div className="panel-status">
        {loading && <span>Lade PDF...</span>}
        {!loading && fileName && (
          <button type="button" onClick={() => onSelectFile(null)}>
            Entfernen
          </button>
        )}
      </div>
      {fileName && !loading && (
        <ul className="panel-meta">
          <li>Datei: {fileName}</li>
          {typeof pageCount === 'number' && <li>Seiten: {pageCount}</li>}
          {fingerprint && <li>Fingerprint: {fingerprint.slice(0, 12)}...</li>}
        </ul>
      )}
      {error && <p className="error">Fehler: {error.message}</p>}
    </div>
  );
}
