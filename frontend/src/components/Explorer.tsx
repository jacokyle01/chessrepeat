import { LibraryBigIcon } from 'lucide-react';
import { moveTotal } from '../services/explorer';
import { useExplorer } from '../hooks/useExplorer';
import './Explorer.css';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Opening explorer, shown in edit mode where the coaching tip sits during
// training. useExplorer tracks the selected position and refetches on
// every change; this component is the view.
export const Explorer = () => {
  const { moves, error } = useExplorer();

  return (
    <div className="explorer">
      <div className="explorer-header">
        <div className="explorer-icon">
          <LibraryBigIcon />
        </div>
        <span className="explorer-title">Opening explorer</span>
      </div>

      {error ? (
        <div className="explorer-empty">Couldn’t load explorer data</div>
      ) : moves === null ? (
        <div className="explorer-empty">Loading…</div>
      ) : moves.length === 0 ? (
        <div className="explorer-empty">No games from this position</div>
      ) : (
        <ul className="explorer-list">
          {moves.map((m) => {
            const games = moveTotal(m);
            return (
              <li key={m.san} className="explorer-row">
                <span className="explorer-move">{m.san}</span>
                <span className="explorer-games">{games.toLocaleString()}</span>
                <span
                  className="explorer-bar"
                  title={`White ${m.whiteWins} · Draw ${m.draw} · Black ${m.blackWins}`}
                >
                  <span className="bar-white" style={{ width: `${pct(m.whiteWins, games)}%` }} />
                  <span className="bar-draw" style={{ width: `${pct(m.draw, games)}%` }} />
                  <span className="bar-black" style={{ width: `${pct(m.blackWins, games)}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
