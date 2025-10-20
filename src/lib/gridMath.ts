import type { GridTransform } from '../state/types';

export type Vec2 = { x: number; y: number };

export type CellCoord = { row: number; col: number };

export function inv2x2(
  a: number,
  b: number,
  c: number,
  d: number,
): [number, number, number, number] | null {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-8) {
    return null;
  }
  const invDet = 1 / det;
  return [d * invDet, -b * invDet, -c * invDet, a * invDet];
}

export function worldToCell(
  point: Vec2,
  grid: GridTransform,
): CellCoord | null {
  const matrix = inv2x2(grid.u.x, grid.v.x, grid.u.y, grid.v.y);
  if (!matrix) return null;

  const dx = point.x - grid.origin.x;
  const dy = point.y - grid.origin.y;

  // Apply inverse affine transform to get fractional col/row
  const col = matrix[0] * dx + matrix[1] * dy;
  const row = matrix[2] * dx + matrix[3] * dy;

  return { row, col };
}

export function cellToWorld(
  row: number,
  col: number,
  grid: GridTransform,
): Vec2 {
  // Forward affine transform maps grid coords back to page space
  return {
    x: grid.origin.x + grid.u.x * col + grid.v.x * row,
    y: grid.origin.y + grid.u.y * col + grid.v.y * row,
  };
}

export function keyOf(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseKey(key: string): CellCoord | null {
  const [r, c] = key.split(':');
  if (r === undefined || c === undefined) return null;
  const row = Number.parseInt(r, 10);
  const col = Number.parseInt(c, 10);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return { row, col };
}

export function deriveOrthogonalGrid(
  points: Vec2[],
  rows: number,
  cols: number,
): GridTransform | null {
  if (rows <= 0 || cols <= 0) return null;
  if (points.length < 2) return null;
  const [p1, p2] = points;
  if (!p1 || !p2) return null;

  const topLeft = {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
  };
  const bottomRight = {
    x: Math.max(p1.x, p2.x),
    y: Math.max(p1.y, p2.y),
  };

  const spanX = bottomRight.x - topLeft.x;
  const spanY = bottomRight.y - topLeft.y;

  const cellWidth = computeOrthogonalUnit(spanX, cols);
  const cellHeight = computeOrthogonalUnit(spanY, rows);

  if (!cellWidth || !cellHeight) return null;
  if (cellWidth <= 0 || cellHeight <= 0) return null;

  const origin = {
    x: topLeft.x - cellWidth / 2,
    y: topLeft.y - cellHeight / 2,
  };

  return {
    origin,
    u: { x: cellWidth, y: 0 },
    v: { x: 0, y: cellHeight },
    rows,
    cols,
  };
}

function computeOrthogonalUnit(span: number, count: number): number | null {
  if (count <= 0) return null;
  const effectiveSpan = Math.abs(span);
  if (count === 1) {
    return effectiveSpan > 0 ? effectiveSpan : null;
  }
  if (effectiveSpan > 0) {
    return effectiveSpan / (count - 1);
  }
  return null;
}
