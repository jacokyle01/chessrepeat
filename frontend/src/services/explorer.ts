import { INITIAL_BOARD_FEN, INITIAL_FEN, makeFen, parseFen } from 'chessops/fen';

const API = import.meta.env.VITE_API_URL;

// The move tree's root node stores a board-only FEN (no side-to-move,
// castling, etc.), which the explorer can't parse and which wouldn't
// match how games were indexed. Complete it to a full FEN before
// querying. The plain starting board maps to INITIAL_FEN specifically
// (with KQkq), since that's the position imported games are keyed by.
function fullFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length >= 4) return fen;
  if (parts[0] === INITIAL_BOARD_FEN) return INITIAL_FEN;
  const parsed = parseFen(fen);
  return parsed.isOk ? makeFen(parsed.value) : fen;
}

// One move played from the queried position, with aggregate results.
// Shape matches the explorer's ResultSummary (note: draws -> "draw").
export type ExplorerMove = {
  san: string;
  whiteWins: number;
  blackWins: number;
  draw: number;
};

type ExplorerStats = {
  results: ExplorerMove[];
};

// Total games recorded for a move (white wins + draws + black wins).
export const moveTotal = (m: ExplorerMove) => m.whiteWins + m.draw + m.blackWins;

// Fetch opening-explorer stats for a FEN via the backend proxy (cookie
// auth). Returns [] when the position is unknown or the request fails;
// aborts cleanly when the caller cancels (position changed).
export async function fetchExplorer(fen: string, signal?: AbortSignal): Promise<ExplorerMove[]> {
  const res = await fetch(`${API}/explorer?fen=${encodeURIComponent(fullFen(fen))}`, {
    credentials: 'include',
    signal,
  });
  if (!res.ok) return [];
  // The explorer returns JSON null for a position with no games.
  const data = (await res.json()) as ExplorerStats | null;
  return data?.results ?? [];
}
