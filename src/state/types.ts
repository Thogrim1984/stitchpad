export type GridTransform = {
  origin: { x: number; y: number };
  u: { x: number; y: number };
  v: { x: number; y: number };
  rows: number;
  cols: number;
};

export type PageState = {
  key: string;
  fingerprint: string;
  pageNumber: number;
  grid?: GridTransform;
  ticks: Set<string>;
  updatedAt?: number;
};

export type Project = {
  id: string;
  title?: string;
  pages: Record<string, PageState>;
  lastOpened?: string;
};

export type PageDoc = {
  key: string;
  fingerprint: string;
  pageNumber: number;
  grid?: GridTransform;
  ticks: string[];
  updatedAt: number;
};
