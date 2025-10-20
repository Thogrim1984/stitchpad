import type { ChangeEvent } from 'react';
import type { Vec2 } from '../lib/gridMath';

type GridCalibratorProps = {
  active: boolean;
  points: Vec2[];
  rows: number;
  cols: number;
  onToggle: () => void;
  onChangeRows: (value: number) => void;
  onChangeCols: (value: number) => void;
  onResetPoints: () => void;
  onConfirm: () => void;
};

export function GridCalibrator({
  active,
  points,
  rows,
  cols,
  onToggle,
  onChangeRows,
  onChangeCols,
  onResetPoints,
  onConfirm,
}: GridCalibratorProps) {
  const ready = points.length === 2 && rows > 0 && cols > 0;

  const handleRows = (event: ChangeEvent<HTMLInputElement>) => {
    onChangeRows(Number(event.target.value) || 0);
  };
  const handleCols = (event: ChangeEvent<HTMLInputElement>) => {
    onChangeCols(Number(event.target.value) || 0);
  };

  const handleConfirm = () => {
    if (!ready) return;
    onConfirm();
  };

  return (
    <div className="panel">
      <h2>Kalibrierung</h2>
      <button type="button" onClick={onToggle} className={active ? 'active' : ''}>
        {active ? 'Kalibrierung beenden' : 'Kalibrieren'}
      </button>
      <p>
        {active
          ? 'Im Canvas jeweils in die Mitte des ersten (oben links) und letzten (unten rechts) Kaestchens klicken.'
          : 'Aktivieren, um das Gitter neu zu kalibrieren.'}
      </p>
      <div className="calibration-points">
        {Array.from({ length: 2 }).map((_, index) => (
          <span key={index} className={points[index] ? 'filled' : ''}>
            P{index + 1}
          </span>
        ))}
        <button type="button" onClick={onResetPoints} disabled={!points.length}>
          Zuruecksetzen
        </button>
      </div>
      <div className="calibration-inputs">
        <label>
          Reihen
          <input
            type="number"
            min={1}
            value={rows || ''}
            onChange={handleRows}
            disabled={!active}
          />
        </label>
        <label>
          Spalten
          <input
            type="number"
            min={1}
            value={cols || ''}
            onChange={handleCols}
            disabled={!active}
          />
        </label>
      </div>
      <button type="button" onClick={handleConfirm} disabled={!ready}>
        Gitter uebernehmen
      </button>
    </div>
  );
}
