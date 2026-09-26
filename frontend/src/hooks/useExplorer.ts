import { useEffect, useState } from 'react';
import { INITIAL_FEN } from 'chessops/fen';
import { useTrainerStore } from '../store/state';
import { ExplorerMove, fetchExplorer, fullFen, moveTotal } from '../services/explorer';
import { CloudEval, fetchCloudEval } from '../services/chessdb';

export type ExplorerResult = {
  // null while a query is in flight (or before the first one).
  moves: ExplorerMove[] | null;
  error: boolean;
  // Cloud eval per move SAN: missing while loading, null when chessdb
  // doesn't know the position (or the request failed).
  evals: Record<string, CloudEval | null>;
};

// Queries the opening explorer for the currently selected position and
// refetches whenever the selected node changes while in edit mode. Only
// runs in edit mode; other training methods leave it idle. In-flight
// requests are aborted when the position changes or the component
// unmounts, so a slow response can't clobber a newer one. Once the moves
// arrive, each one's chessdb cloud eval is fetched in parallel.
export function useExplorer(): ExplorerResult {
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);

  const [moves, setMoves] = useState<ExplorerMove[] | null>(null);
  const [error, setError] = useState(false);
  const [evals, setEvals] = useState<Record<string, CloudEval | null>>({});

  const active = trainingMethod === 'edit';
  // fetchExplorer normalizes board-only FENs; the null-node fallback is
  // the starting position.
  const fen = selectedNode?.data.fen ?? INITIAL_FEN;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const { signal } = controller;
    setMoves(null);
    setError(false);
    setEvals({});
    fetchExplorer(fen, signal)
      .then((m) => {
        setMoves([...m].sort((a, b) => moveTotal(b) - moveTotal(a)));
        for (const { san } of m) {
          fetchCloudEval(fullFen(fen), san, signal)
            .catch(() => null)
            .then((e) => {
              if (!signal.aborted) setEvals((prev) => ({ ...prev, [san]: e }));
            });
        }
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [fen, active]);

  return { moves, error, evals };
}
