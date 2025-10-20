import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { downloadJson } from '../lib/file';
import { zProjectFile } from '../state/schema';
import { pageStateToDoc, savePage } from '../state/db';
import { useStore } from '../state/store';
import type { PageState, Project } from '../state/types';

export function ImportExport() {
  const project = useStore((state) => state.project);
  const setProject = useStore((state) => state.setProject);
  const setCurrentPage = useStore((state) => state.setCurrentPage);

  const [message, setMessage] = useState<string | null>(null);

  const handleExport = () => {
    if (!project) {
      setMessage('Kein Projekt geladen.');
      return;
    }

    const payload = {
      version: 1 as const,
      project: {
        id: project.id,
        title: project.title,
      },
      pages: Object.values(project.pages).map((page) => ({
        fingerprint: page.fingerprint,
        page: page.pageNumber,
        grid: page.grid,
        ticks: Array.from(page.ticks),
      })),
    };

    downloadJson(payload, `${project.title ?? 'stitchpad'}.stitchproj.json`);
    setMessage('Projekt exportiert.');
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = zProjectFile.safeParse(json);
      if (!result.success) {
        setMessage('Import fehlgeschlagen: ' + result.error.message);
        return;
      }

      const imported = result.data;
      const pagesEntries: [string, PageState][] = imported.pages.map((page) => {
        const key = `${page.fingerprint}:${page.page}`;
        const state: PageState = {
          key,
          fingerprint: page.fingerprint,
          pageNumber: page.page,
          grid: page.grid,
          ticks: new Set(page.ticks),
          updatedAt: Date.now(),
        };
        return [key, state];
      });

      const next: Project = {
        id: imported.project.id ?? crypto.randomUUID(),
        title: imported.project.title,
        pages: Object.fromEntries(pagesEntries),
        lastOpened: pagesEntries[0]?.[0],
      };

      setProject(next);
      if (next.lastOpened) {
        setCurrentPage(next.lastOpened);
      }

      await Promise.all(
        pagesEntries.map(([_, page]) => savePage(pageStateToDoc(page))),
      );

      setMessage('Projekt importiert.');
    } catch (error) {
      setMessage('Import fehlgeschlagen: ' + (error as Error).message);
    }
  };

  return (
    <div className="panel">
      <h2>Import / Export</h2>
      <button type="button" onClick={handleExport} disabled={!project}>
        Exportieren
      </button>
      <label className="import-label">
        Importieren
        <input type="file" accept="application/json" onChange={handleImport} />
      </label>
      {message && <p className="info">{message}</p>}
    </div>
  );
}
