import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '../lib/pdf';
import {
  cellToWorld,
  deriveOrthogonalGrid,
  keyOf,
  parseKey,
  worldToCell,
} from '../lib/gridMath';
import type { Vec2 } from '../lib/gridMath';
import { useViewport } from '../hooks/useViewport';
import { useStore } from '../state/store';
import { pageStateToDoc, savePage } from '../state/db';

type PageViewportProps = {
  doc: PDFDocumentProxy | null;
  pageKey: string | null;
  calibrating: boolean;
  calibrationRows: number;
  calibrationCols: number;
  onCaptureCalibrationPoint: (point: Vec2) => void;
  calibrationPoints: Vec2[];
};

const BASE_RENDER_SCALE = 1.5;

export function PageViewport({
  doc,
  pageKey,
  calibrating,
  calibrationRows,
  calibrationCols,
  onCaptureCalibrationPoint,
  calibrationPoints,
}: PageViewportProps) {
  const pageState = useStore((state) =>
    pageKey ? state.project?.pages[pageKey] : undefined,
  );
  const toggleTick = useStore((state) => state.toggleTick);

  const viewport = useViewport(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [cursorCell, setCursorCell] = useState<{ row: number; col: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  const dragState = useRef<{
    mode: 'add' | 'remove' | null;
    active: boolean;
    lastCell: string | null;
  }>({ mode: null, active: false, lastCell: null });

  const panState = useRef<{
    active: boolean;
    originX: number;
    originY: number;
    startOffsetX: number;
    startOffsetY: number;
  }>({
    active: false,
    originX: 0,
    originY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });

  useEffect(() => {
    if (!doc || !pageState || !pdfCanvasRef.current) return;
    let cancelled = false;
    const canvas = pdfCanvasRef.current;

    (async () => {
      const page = await doc.getPage(pageState.pageNumber);
      if (cancelled) {
        page.cleanup();
        return;
      }
      await renderPageToCanvas(page, canvas, BASE_RENDER_SCALE);
      if (cancelled) {
        page.cleanup();
        return;
      }
      setPageSize({ width: canvas.width, height: canvas.height });
      page.cleanup();
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, pageState?.pageNumber]);

  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    overlayCanvasRef.current.width = pageSize.width;
    overlayCanvasRef.current.height = pageSize.height;
  }, [pageSize]);

  useEffect(() => {
    if (!overlayCanvasRef.current || !pageState || !pageSize.width) return;
    const ctx = overlayCanvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, pageSize.width, pageSize.height);

    const grid = pageState.grid;
    if (grid) {
      if (showGrid) {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 0; r <= grid.rows; r += 1) {
          const start = cellToWorld(r, 0, grid);
          const end = cellToWorld(r, grid.cols, grid);
          ctx.moveTo(start.x * pageSize.width, start.y * pageSize.height);
          ctx.lineTo(end.x * pageSize.width, end.y * pageSize.height);
        }
        for (let c = 0; c <= grid.cols; c += 1) {
          const start = cellToWorld(0, c, grid);
          const end = cellToWorld(grid.rows, c, grid);
          ctx.moveTo(start.x * pageSize.width, start.y * pageSize.height);
          ctx.lineTo(end.x * pageSize.width, end.y * pageSize.height);
        }
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,0,0,0.35)';
      for (const key of pageState.ticks) {
        const coord = parseKey(key);
        if (!coord) continue;
        const { row, col } = coord;
        if (
          row < 0 ||
          row >= grid.rows ||
          col < 0 ||
          col >= grid.cols
        ) {
          continue;
        }
        // Draw filled quad for ticked cell
        const corners = [
          cellToWorld(row, col, grid),
          cellToWorld(row, col + 1, grid),
          cellToWorld(row + 1, col + 1, grid),
          cellToWorld(row + 1, col, grid),
        ];
        ctx.beginPath();
        ctx.moveTo(corners[0].x * pageSize.width, corners[0].y * pageSize.height);
        for (let i = 1; i < corners.length; i += 1) {
          ctx.lineTo(
            corners[i].x * pageSize.width,
            corners[i].y * pageSize.height,
          );
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    if (calibrating) {
      ctx.fillStyle = 'rgba(0, 128, 255, 0.6)';
      calibrationPoints.forEach((point) => {
        const x = point.x * pageSize.width;
        const y = point.y * pageSize.height;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      const previewGrid = deriveOrthogonalGrid(
        calibrationPoints,
        calibrationRows,
        calibrationCols,
      );

      if (previewGrid) {
        const topLeft = previewGrid.origin;
        const bottomRight = cellToWorld(
          previewGrid.rows,
          previewGrid.cols,
          previewGrid,
        );
        const originX = topLeft.x * pageSize.width;
        const originY = topLeft.y * pageSize.height;
        const widthPx = (bottomRight.x - topLeft.x) * pageSize.width;
        const heightPx = (bottomRight.y - topLeft.y) * pageSize.height;

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(originX, originY, widthPx, heightPx);
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let r = 0; r <= previewGrid.rows; r += 1) {
          const start = cellToWorld(r, 0, previewGrid);
          const end = cellToWorld(r, previewGrid.cols, previewGrid);
          ctx.moveTo(start.x * pageSize.width, start.y * pageSize.height);
          ctx.lineTo(end.x * pageSize.width, end.y * pageSize.height);
        }
        for (let c = 0; c <= previewGrid.cols; c += 1) {
          const start = cellToWorld(0, c, previewGrid);
          const end = cellToWorld(previewGrid.rows, c, previewGrid);
          ctx.moveTo(start.x * pageSize.width, start.y * pageSize.height);
          ctx.lineTo(end.x * pageSize.width, end.y * pageSize.height);
        }
        ctx.stroke();
      } else if (calibrationPoints.length === 2) {
        const [a, b] = calibrationPoints;
        const minX = Math.min(a.x, b.x) * pageSize.width;
        const maxX = Math.max(a.x, b.x) * pageSize.width;
        const minY = Math.min(a.y, b.y) * pageSize.height;
        const maxY = Math.max(a.y, b.y) * pageSize.height;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.setLineDash([]);
      }
    }
  }, [
    pageState,
    pageSize,
    showGrid,
    calibrating,
    calibrationPoints,
    calibrationRows,
    calibrationCols,
  ]);

  useEffect(() => {
    if (!pageState || !pageState.updatedAt) return;
    const docData = pageStateToDoc(pageState);
    const handle = window.setTimeout(() => {
      void savePage(docData);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pageState?.key, pageState?.updatedAt]);

  const statusText = useMemo(() => {
    if (!doc) return 'Kein PDF geladen.';
    if (!pageState) return 'Keine Seite ausgewaehlt.';
    if (!pageState.grid) return 'Kalibrierung erforderlich.';
    if (!cursorCell) return 'Cursor ausserhalb.';
    return `Zeile ${cursorCell.row + 1}, Spalte ${cursorCell.col + 1}`;
  }, [cursorCell, doc, pageState]);

  const getNormalizedPoint = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !pageSize.width) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;

      const worldX = (screenX - viewport.offset.x) / viewport.scale;
      const worldY = (screenY - viewport.offset.y) / viewport.scale;
      if (
        Number.isNaN(worldX) ||
        Number.isNaN(worldY) ||
        !Number.isFinite(worldX) ||
        !Number.isFinite(worldY)
      ) {
        return null;
      }

      const normX = worldX / pageSize.width;
      const normY = worldY / pageSize.height;
      return { normX, normY, screenX, screenY };
    },
    [pageSize, viewport.offset.x, viewport.offset.y, viewport.scale],
  );

  const updateCursor = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!pageState?.grid) {
        setCursorCell(null);
        return;
      }
      const point = getNormalizedPoint(event);
      if (!point) {
        setCursorCell(null);
        return;
      }

      const cell = worldToCell(
        { x: point.normX, y: point.normY },
        pageState.grid,
      );
      if (!cell) {
        setCursorCell(null);
        return;
      }

      const row = Math.floor(cell.row);
      const col = Math.floor(cell.col);
      if (
        row < 0 ||
        row >= pageState.grid.rows ||
        col < 0 ||
        col >= pageState.grid.cols
      ) {
        setCursorCell(null);
        return;
      }
      setCursorCell({ row, col });
    },
    [getNormalizedPoint, pageState],
  );

  const startPainting = useCallback(
    (row: number, col: number, event: PointerEvent<HTMLDivElement>) => {
      if (!pageState) return;
      const key = keyOf(row, col);
      const currentlyChecked = pageState.ticks.has(key);
      let force: boolean;
      if (event.altKey) {
        force = true;
        dragState.current.mode = 'add';
      } else if (event.ctrlKey || event.metaKey) {
        force = false;
        dragState.current.mode = 'remove';
      } else {
        force = !currentlyChecked;
        dragState.current.mode = force ? 'add' : 'remove';
      }
      dragState.current.active = true;
      dragState.current.lastCell = key;
      toggleTick(pageState.key, row, col, force);
    },
    [pageState, toggleTick],
  );

  const paintAt = useCallback(
    (row: number, col: number) => {
      if (!pageState) return;
      if (!dragState.current.active || !dragState.current.mode) return;
      const key = keyOf(row, col);
      if (dragState.current.lastCell === key) return;
      const force = dragState.current.mode === 'add';
      dragState.current.lastCell = key;
      toggleTick(pageState.key, row, col, force);
    },
    [pageState, toggleTick],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    containerRef.current.setPointerCapture(event.pointerId);
    containerRef.current.focus();
    updateCursor(event);

    if (!pageState) return;
    const point = getNormalizedPoint(event);
    if (!point) return;

    if (calibrating && event.button === 0) {
      onCaptureCalibrationPoint({ x: point.normX, y: point.normY });
      return;
    }

    if (event.button === 1 || event.button === 2) {
      event.preventDefault();
      panState.current = {
        active: true,
        originX: event.clientX,
        originY: event.clientY,
        startOffsetX: viewport.offset.x,
        startOffsetY: viewport.offset.y,
      };
      return;
    }

    if (event.button !== 0 || !pageState.grid) return;

    const cell = worldToCell(
      { x: point.normX, y: point.normY },
      pageState.grid,
    );
    if (!cell) return;

    const row = Math.floor(cell.row);
    const col = Math.floor(cell.col);
    if (
      row < 0 ||
      row >= pageState.grid.rows ||
      col < 0 ||
      col >= pageState.grid.cols
    ) {
      return;
    }
    startPainting(row, col, event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    updateCursor(event);
    const point = getNormalizedPoint(event);
    if (panState.current.active) {
      const dx = event.clientX - panState.current.originX;
      const dy = event.clientY - panState.current.originY;
      viewport.setOffset({
        x: panState.current.startOffsetX + dx,
        y: panState.current.startOffsetY + dy,
      });
      return;
    }
    if (
      dragState.current.active &&
      pageState?.grid &&
      event.buttons & 1 &&
      point
    ) {
      const cell = worldToCell(
        { x: point.normX, y: point.normY },
        pageState.grid,
      );
      if (!cell) return;

      const row = Math.floor(cell.row);
      const col = Math.floor(cell.col);
      if (
        row < 0 ||
        row >= pageState.grid.rows ||
        col < 0 ||
        col >= pageState.grid.cols
      ) {
        return;
      }
      paintAt(row, col);
    }
  };

  const stopPointerOps = () => {
    dragState.current.active = false;
    dragState.current.mode = null;
    dragState.current.lastCell = null;
    panState.current.active = false;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      try {
        containerRef.current.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if pointer was not captured
      }
    }
    stopPointerOps();
  };

  const handlePointerLeave = () => {
    setCursorCell(null);
    stopPointerOps();
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const wheelListener = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const delta = event.deltaY > 0 ? -1 : 1;
      viewport.zoomAt(mx, my, delta);
    };
    node.addEventListener('wheel', wheelListener, { passive: false });
    return () => {
      node.removeEventListener('wheel', wheelListener);
    };
  }, [viewport.zoomAt]);

  if (!doc) {
    return <div className="viewport-placeholder">PDF laden, um zu starten.</div>;
  }

  if (!pageState) {
    return (
      <div className="viewport-placeholder">
        Seite auswaehlen, um das Gitter zu sehen.
      </div>
    );
  }

  return (
    <div className="viewport-shell">
      <div
        className="viewport-stage"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        tabIndex={0}
      >
        <div
          className="viewport-inner"
          style={{
            transform: `translate(${viewport.offset.x}px, ${viewport.offset.y}px) scale(${viewport.scale})`,
            width: pageSize.width,
            height: pageSize.height,
          }}
        >
          <canvas ref={pdfCanvasRef} className="pdf-canvas" />
          <canvas ref={overlayCanvasRef} className="overlay-canvas" />
        </div>
      </div>
      <div className="viewport-toolbar">
        <span>{statusText}</span>
        <button type="button" onClick={() => viewport.reset()}>
          Reset View
        </button>
        <button type="button" onClick={() => setShowGrid((prev) => !prev)}>
          Gitter {showGrid ? 'ausblenden' : 'einblenden'}
        </button>
      </div>
    </div>
  );
}
