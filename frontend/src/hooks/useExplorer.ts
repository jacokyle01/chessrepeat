import { useEffect, useState } from 'react';
import { INITIAL_FEN } from 'chessops/fen';
import { useTrainerStore } from '../store/state';
import { ExplorerMove, fetchExplorer, moveTotal } from '../services/explorer';

export type ExplorerResult = {
  // null while a query is in flight (or before the first one).
  moves: ExplorerMove[] | null;
  error: boolean;
};

// Queries the opening explorer for the currently selected position and
// refetches whenever the selected node changes while in edit mode. Only
// runs in edit mode; other training methods leave it idle. In-flight
// requests are aborted when the position changes or the component
// unmounts, so a slow response can't clobber a newer one.
export function useExplorer(): ExplorerResult {
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);

  const [moves, setMoves] = useState<ExplorerMove[] | null>(null);
  const [error, setError] = useState(false);

  const active = trainingMethod === 'edit';
  // fetchExplorer normalizes board-only FENs; the null-node fallback is
  // the starting position.
  const fen = selectedNode?.data.fen ?? INITIAL_FEN;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setMoves(null);
    setError(false);
    fetchExplorer(fen, controller.signal)
      .then((m) => setMoves([...m].sort((a, b) => moveTotal(b) - moveTotal(a))))
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [fen, active]);

  return { moves, error };
}
