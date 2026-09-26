import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';

const CDB = 'https://www.chessdb.cn/cdb.php';

// Cloud evaluation of a position, in centipawns from White's point of view.
export type CloudEval = { score: number; depth: number };

// Move-tree nodes can carry "-" castling rights (built from a board-only
// root), and chessdb keys positions on castling: a "-" FEN finds a far
// shallower analysis, or none. Restore rights wherever king and rook
// still stand on their home squares. This is wrong only if a king or rook
// left and came back, which is rare in the opening.
function withCastling(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length < 3 || parts[2] !== '-') return fen;
  // Expand digits so each rank is 8 chars indexed a..h.
  const rows = parts[0].split('/').map((r) => r.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  const [black, white] = [rows[0], rows[7]];
  let rights = '';
  if (white[4] === 'K') {
    if (white[7] === 'R') rights += 'K';
    if (white[0] === 'R') rights += 'Q';
  }
  if (black[4] === 'k') {
    if (black[7] === 'r') rights += 'k';
    if (black[0] === 'r') rights += 'q';
  }
  parts[2] = rights || '-';
  return parts.join(' ');
}

// FEN of the position after playing `san` from `fen`, or null if the move
// doesn't parse there.
function fenAfter(fen: string, san: string): string | null {
  const setup = parseFen(withCastling(fen));
  if (!setup.isOk) return null;
  const pos = Chess.fromSetup(setup.value);
  if (!pos.isOk) return null;
  const move = parseSan(pos.value, san);
  if (!move) return null;
  pos.value.play(move);
  return makeFen(pos.value.toSetup());
}

// Query chessdb's analysis line (querypv) for the position after `san`.
// Returns null when chessdb doesn't know the position. chessdb scores are
// from the side to move, so flip to White's view.
export async function fetchCloudEval(
  fen: string,
  san: string,
  signal?: AbortSignal,
): Promise<CloudEval | null> {
  const board = fenAfter(fen, san);
  if (!board) return null;
  const res = await fetch(`${CDB}?action=querypv&json=1&board=${encodeURIComponent(board)}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.status !== 'ok' || typeof data.score !== 'number') return null;
  const whiteToMove = board.split(' ')[1] === 'w';
  return { score: whiteToMove ? data.score : -data.score, depth: data.depth };
}

// chessdb reports mates as scores near ±30000 (30000 minus plies to mate).
const MATE = 20000;

// Format an eval for display: "+0.35", "−1.20", "+M3".
export function formatEval(score: number): string {
  const sign = score > 0 ? '+' : score < 0 ? '−' : '';
  const abs = Math.abs(score);
  if (abs >= MATE) return `${sign}M${Math.ceil((30000 - abs) / 2)}`;
  return `${sign}${(abs / 100).toFixed(2)}`;
}
