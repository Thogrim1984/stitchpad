import type { PageState } from '../state/types';

type PageListProps = {
  pages: PageState[];
  currentKey: string | null;
  onSelect: (key: string) => void;
};

export function PageList({ pages, currentKey, onSelect }: PageListProps) {
  if (!pages.length) {
    return (
      <div className="panel">
        <h2>Seiten</h2>
        <p>PDF laden, um Seiten zu sehen.</p>
      </div>
    );
  }

  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  return (
    <div className="panel">
      <h2>Seiten</h2>
      <div className="page-list">
        {sorted.map((page) => (
          <button
            key={page.key}
            type="button"
            className={page.key === currentKey ? 'active' : ''}
            onClick={() => onSelect(page.key)}
          >
            Seite {page.pageNumber}
            {page.grid && <span className="badge">*</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
