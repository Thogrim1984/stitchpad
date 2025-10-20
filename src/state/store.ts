import { create } from 'zustand';
import type { GridTransform, PageState, Project } from './types';
import { keyOf } from '../lib/gridMath';

type StoreState = {
  project: Project | null;
  currentPageKey: string | null;
  setProject: (project: Project | null) => void;
  ensureProject: () => Project;
  upsertPage: (page: PageState) => void;
  setCurrentPage: (key: string | null) => void;
  toggleTick: (key: string, row: number, col: number, force?: boolean) => void;
  setGrid: (key: string, grid: GridTransform) => void;
};

export const useStore = create<StoreState>((set, get) => ({
  project: null,
  currentPageKey: null,
  setProject: (project) =>
    set(() => ({
      project,
      currentPageKey: project?.lastOpened ?? null,
    })),
  ensureProject: () => {
    const current = get().project;
    if (current) return current;
    const fresh: Project = {
      id: createId(),
      pages: {},
    };
    set({ project: fresh, currentPageKey: null });
    return fresh;
  },
  upsertPage: (page) =>
    set((state) => {
      const project = state.project ?? {
        id: createId(),
        pages: {},
      };
      return {
        project: {
          ...project,
          pages: {
            ...project.pages,
            [page.key]: page,
          },
        },
      };
    }),
  setCurrentPage: (key) =>
    set((state) => {
      if (!state.project) return { currentPageKey: key };
      return {
        project: { ...state.project, lastOpened: key ?? undefined },
        currentPageKey: key,
      };
    }),
  toggleTick: (key, row, col, force) =>
    set((state) => {
      if (!state.project) return {};
      const page = state.project.pages[key];
      if (!page) return {};
      const cellKey = keyOf(row, col);
      const nextTicks = new Set(page.ticks);
      const has = nextTicks.has(cellKey);
      const shouldSet = force ?? !has;
      if (shouldSet) {
        nextTicks.add(cellKey);
      } else {
        nextTicks.delete(cellKey);
      }
      const updated: PageState = {
        ...page,
        ticks: nextTicks,
        updatedAt: Date.now(),
      };
      return {
        project: {
          ...state.project,
          pages: {
            ...state.project.pages,
            [key]: updated,
          },
        },
      };
    }),
  setGrid: (key, grid) =>
    set((state) => {
      if (!state.project) return {};
      const page = state.project.pages[key];
      if (!page) return {};
      const updated: PageState = {
        ...page,
        grid,
        updatedAt: Date.now(),
      };
      return {
        project: {
          ...state.project,
          pages: {
            ...state.project.pages,
            [key]: updated,
          },
        },
      };
    }),
}));

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
