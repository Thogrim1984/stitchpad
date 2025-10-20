import { useEffect, useMemo, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfLoader } from '../components/PdfLoader';
import { PageList } from '../components/PageList';
import { PageViewport } from '../components/PageViewport';
import { GridCalibrator } from '../components/GridCalibrator';
import { ImportExport } from '../components/ImportExport';
import { usePdf } from '../hooks/usePdf';
import { useStore } from '../state/store';
import { loadPage, pageDocToState } from '../state/db';
import type { PageState, Project } from '../state/types';
import { deriveOrthogonalGrid } from '../lib/gridMath';
import type { Vec2 } from '../lib/gridMath';

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const pdf = usePdf(file);

  const project = useStore((state) => state.project);
  const setProject = useStore((state) => state.setProject);
  const setCurrentPage = useStore((state) => state.setCurrentPage);
  const currentPageKey = useStore((state) => state.currentPageKey);
  const setGrid = useStore((state) => state.setGrid);

  const [calibrating, setCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Vec2[]>([]);
  const [calibrationRows, setCalibrationRows] = useState(0);
  const [calibrationCols, setCalibrationCols] = useState(0);

  const currentPage = useMemo<PageState | undefined>(() => {
    if (!project || !currentPageKey) return undefined;
    return project.pages[currentPageKey];
  }, [project, currentPageKey]);

  useEffect(() => {
    if (!file) {
      setProject(null);
      setCurrentPage(null);
      setCalibrating(false);
      setCalibrationPoints([]);
    }
  }, [file, setProject, setCurrentPage]);

  useEffect(() => {
    if (!pdf.doc || !pdf.fingerprint) return;
    let cancelled = false;

    const bootstrapProject = async (
      doc: PDFDocumentProxy,
      fingerprint: string,
    ) => {
      const pagesEntries: [string, PageState][] = [];
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        const key = `${fingerprint}:${pageNumber}`;
        const stored = await loadPage(key);
        if (cancelled) return;
        const pageState =
          stored !== undefined
            ? pageDocToState(stored)
            : {
                key,
                fingerprint,
                pageNumber,
                ticks: new Set<string>(),
                updatedAt: Date.now(),
              };
        pagesEntries.push([key, pageState]);
      }
      if (cancelled) return;

      const pages = Object.fromEntries(pagesEntries);
      const projectPayload: Project = {
        id: fingerprint,
        title: file?.name,
        pages,
        lastOpened: pagesEntries[0]?.[0],
      };
      setProject(projectPayload);
      if (projectPayload.lastOpened) {
        setCurrentPage(projectPayload.lastOpened);
      }
    };

    void bootstrapProject(pdf.doc, pdf.fingerprint);

    return () => {
      cancelled = true;
    };
  }, [pdf.doc, pdf.fingerprint, file, setProject, setCurrentPage]);

  useEffect(() => {
    if (currentPage?.grid) {
      setCalibrationRows(currentPage.grid.rows);
      setCalibrationCols(currentPage.grid.cols);
    } else {
      setCalibrationRows(0);
      setCalibrationCols(0);
    }
  }, [currentPage?.grid, currentPageKey]);

  useEffect(() => {
    setCalibrationPoints([]);
  }, [currentPageKey]);

  const handleToggleCalibration = () => {
    setCalibrating((prev) => {
      const next = !prev;
      if (next) {
        setCalibrationPoints([]);
        if (currentPage?.grid) {
          setCalibrationRows(currentPage.grid.rows);
          setCalibrationCols(currentPage.grid.cols);
        }
      }
      return next;
    });
  };

  const handleCalibrationPoint = (point: Vec2) => {
    setCalibrationPoints((prev) => {
      if (prev.length >= 2) return prev;
      return [...prev, point];
    });
  };

  const handleConfirmGrid = () => {
    if (!currentPageKey) return;
    const grid = deriveOrthogonalGrid(
      calibrationPoints,
      calibrationRows,
      calibrationCols,
    );
    if (!grid) return;

    setGrid(currentPageKey, grid);
    setCalibrationPoints([]);
    setCalibrating(false);
    setCalibrationRows(grid.rows);
    setCalibrationCols(grid.cols);
  };

  const pagesList = useMemo(() => {
    if (!project) return [];
    return Object.values(project.pages);
  }, [project]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <PdfLoader
          fileName={file?.name}
          loading={pdf.loading}
          error={pdf.error}
          fingerprint={pdf.fingerprint}
          pageCount={pdf.doc?.numPages}
          onSelectFile={setFile}
        />
        <PageList
          pages={pagesList}
          currentKey={currentPageKey}
          onSelect={setCurrentPage}
        />
        <GridCalibrator
          active={calibrating}
          points={calibrationPoints}
          rows={calibrationRows}
          cols={calibrationCols}
          onToggle={handleToggleCalibration}
          onChangeRows={setCalibrationRows}
          onChangeCols={setCalibrationCols}
          onResetPoints={() => setCalibrationPoints([])}
          onConfirm={handleConfirmGrid}
        />
        <ImportExport />
        <div className="instructions">
          <h3>Schnellstart</h3>
          <ol>
            <li>PDF hochladen.</li>
            <li>Seite waehlen.</li>
            <li>Kalibrieren (oben links & unten rechts + Reihen/Spalten).</li>
            <li>Zellen anklicken oder ziehen.</li>
          </ol>
        </div>
      </aside>
      <main className="main">
        <PageViewport
          doc={pdf.doc}
          pageKey={currentPageKey}
          calibrating={calibrating}
          calibrationRows={calibrationRows}
          calibrationCols={calibrationCols}
          calibrationPoints={calibrationPoints}
          onCaptureCalibrationPoint={handleCalibrationPoint}
        />
      </main>
    </div>
  );
}
