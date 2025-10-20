import { useCallback, useState } from 'react';

export type ViewportState = {
  scale: number;
  offset: { x: number; y: number };
  zoomAt: (screenX: number, screenY: number, delta: number) => void;
  panBy: (dx: number, dy: number) => void;
  setOffset: (next: { x: number; y: number }) => void;
  reset: () => void;
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.1;

export function useViewport(initialScale = 1): ViewportState {
  const [scale, setScale] = useState(initialScale);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const zoomAt = useCallback(
    (screenX: number, screenY: number, delta: number) => {
      const zoomFactor = Math.exp(delta * ZOOM_STEP);
      const nextScale = clamp(scale * zoomFactor, MIN_SCALE, MAX_SCALE);
      if (nextScale === scale) return;

      const worldX = (screenX - offset.x) / scale;
      const worldY = (screenY - offset.y) / scale;

      // Maintain world point under cursor after zoom
      setScale(nextScale);
      setOffset({
        x: screenX - worldX * nextScale,
        y: screenY - worldY * nextScale,
      });
    },
    [scale, offset],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const setOffsetDirect = useCallback((next: { x: number; y: number }) => {
    setOffset(next);
  }, []);

  const reset = useCallback(() => {
    setScale(initialScale);
    setOffset({ x: 0, y: 0 });
  }, [initialScale]);

  return { scale, offset, zoomAt, panBy, setOffset: setOffsetDirect, reset };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
