import { moveTotal } from '../services/explorer';
import { formatEval } from '../services/chessdb';
import { useExplorer } from '../hooks/useExplorer';
import { useTrainerStore } from '../store/state';
import './Explorer.css';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Opening explorer, shown in edit mode where the coaching tip sits during
// training. useExplorer tracks the selected position and refetches on
// every change; this component is the view. Clicking a row plays its
// move, same as playing it on the board.
export const Explorer = () => {
  const { moves, error, evals } = useExplorer();
  const makeMove = useTrainerStore((s) => s.makeMove);

  return (
    <div className="explorer">
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
            const ev = evals[m.san];
            return (
              <li
                key={m.san}
                className="explorer-row"
                role="button"
                tabIndex={0}
                onClick={() => makeMove(m.san)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    makeMove(m.san);
                  }
                }}
              >
                <span className="explorer-move">{m.san}</span>
                <span
                  className="explorer-eval"
                  title={ev ? `chessdb cloud eval, depth ${ev.depth}` : undefined}
                >
                  {ev === undefined ? '…' : ev === null ? '–' : formatEval(ev.score)}
                </span>
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
