import Dexie, { type Table } from 'dexie';
import type { PageDoc, PageState } from './types';

class StitchpadDB extends Dexie {
  pages!: Table<PageDoc, string>;

  constructor() {
    super('stitchpad');
    this.version(1).stores({
      pages: '&key,fingerprint,pageNumber,updatedAt',
    });
  }
}

export const db = new StitchpadDB();

export async function savePage(page: PageDoc): Promise<void> {
  try {
    await db.pages.put({
      ...page,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.warn('Failed to save page', page.key, error);
  }
}

export async function loadPage(key: string): Promise<PageDoc | undefined> {
  try {
    return await db.pages.get(key);
  } catch (error) {
    console.warn('Failed to load page', key, error);
    return undefined;
  }
}

export function pageStateToDoc(page: PageState): PageDoc {
  return {
    key: page.key,
    fingerprint: page.fingerprint,
    pageNumber: page.pageNumber,
    grid: page.grid,
    ticks: Array.from(page.ticks),
    updatedAt: page.updatedAt ?? Date.now(),
  };
}

export function pageDocToState(doc: PageDoc): PageState {
  return {
    key: doc.key,
    fingerprint: doc.fingerprint,
    pageNumber: doc.pageNumber,
    grid: doc.grid,
    ticks: new Set(doc.ticks),
    updatedAt: doc.updatedAt,
  };
}
