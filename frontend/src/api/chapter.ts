import { Chapter, Color, TrainableNode, TrainingData } from '../types/training';

const API_URL = import.meta.env.VITE_API_URL;


// provide context so moveRow[] can be reconstructed
// into tree 
export interface MoveRow extends TrainingData {
  parentIdx: number | null; // null = root
  ord: number; // sibling ordering (variation order)
}

export interface ChapterNormalized {
  name: string;
  id: string;
  lastDueCount: number;
  trainAs: Color;
  enabledCount: number;
  bucketEntries: number[];
  moves: MoveRow[]; // normalized move-tree
  revision?: number; // (optional) for sync
  updatedAt?: number; // (optional) unix ms
}
export function normalizeMoveTree(root: TrainableNode): MoveRow[] {
  const out: MoveRow[] = [];


  //TODO we dont need a lot of these fields
  function visit(node: TrainableNode, parentIdx: number | null, ord: number) {
    out.push({
      idx: node.data.idx,
      id: node.data.id,
      parentIdx,
      ord,
      fen: node.data.fen,
      ply: node.data.ply,
      san: node.data.san,
      comment: node.data.comment,
      training: node.data.training,
    });

    const kids = node.children ?? [];
    kids.forEach((child, idx) => visit(child, node.data.idx, idx));
  }

  // root ord can be 0 (ignored by server anyway)
  visit(root, null, 0);
  return out;
}

function normalizeChapter(chapter: Chapter): ChapterNormalized {
  console.log("api", API_URL)

  // If chapter.moves is actually a tree array, pick the root.
  // Prefer the one that has no parent or is explicitly root in your app.
  // For MVP: assume first item is the root.
  const root = chapter.root;
  if (!root) throw new Error('normalizeChapter: chapter has no moves/root');

  const moves = normalizeMoveTree(root);

  return {
    name: chapter.name,
    id: chapter.id,
    lastDueCount: chapter.lastDueCount,
    trainAs: chapter.trainAs,
    enabledCount: chapter.enabledCount,
    bucketEntries: chapter.bucketEntries,
    moves,
    // optional
    updatedAt: Date.now(),
  };
}

/*
  POST chapter to chessrepeat backend 
  
  transform tree into normalized MoveRow[] to 
  simplify server-side training operations


*/
export async function postChapter(chapter: Chapter) {
  const normalizedChapter = normalizeChapter(chapter);
  console.log('Flattened chapter', normalizedChapter);

  const res = await fetch(`${API_URL}/api/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizedChapter),
    credentials: 'include', // sends the session cookie
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Create chapter failed (${res.status}): ${text}`);
  }
  return res.json(); // { id, revision } (or whatever your backend returns)
}
