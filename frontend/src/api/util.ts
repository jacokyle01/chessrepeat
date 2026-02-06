//TODO bugs w/ id and idx?
//TODO separate "active chapter" datatype, OR
// separate in-memory chapter datatype when loaded from storage

import { Chapter, FlatChapter, MoveRow, TrainableNode } from '../types/training';

//TODO types here..
export function rebuildMoveTree(rows: MoveRow[]): TrainableNode {
  const byId = new Map<number, any>();
  const childrenByParent = new Map<number | null, MoveRow[]>();

  // 1) use map to map parent-->child
  //TODO should flatten data...?
  for (const r of rows) {
    byId.set(r.idx, {
      data: {
        id: r.id,
        idx: r.idx,
        fen: r.fen,
        ply: r.ply,
        san: r.san,
        comment: r.comment ?? null,
        training: r.training,
      },
      children: [],
    });

    const list = childrenByParent.get(r.parentIdx) ?? [];
    list.push(r);
    childrenByParent.set(r.parentIdx, list);
  }

  // 2) enforce move variation orderings
  for (const [parentIdx, list] of childrenByParent.entries()) {
    list.sort((a, b) => a.ord - b.ord);
    childrenByParent.set(parentIdx, list);
  }

  // 3) find root (parentIdx === null)
  const roots = childrenByParent.get(null) ?? [];
  // if (roots.length !== 1) {
  //   throw new Error(`Expected exactly 1 root, got ${roots.length}`);
  // }

  const rootRow = roots[0];
  const root = byId.get(rootRow.idx);
  if (!root) throw new Error(`Root row id ${rootRow.idx} missing from byId`);

  // 4) recursive function
  function build(parentIdx: number) {
    const parent = byId.get(parentIdx);
    if (!parent) throw new Error(`Parent id ${parentIdx} missing from byId`);

    const kids = childrenByParent.get(parentIdx) ?? [];
    parent.children = kids.map((k) => {
      const child = byId.get(k.idx);
      if (!child) throw new Error(`Child id ${k.id} missing from byId`);
      return child;
    });

    for (const k of kids) build(k.idx);
  }

  build(rootRow.idx);
  return root;
}

//TODO mostly placeholder for now, but later on should perform a full loop of chapter to recalculate some
// in-memory specific fields... ALSO TODO, figure out how to break up multiple function calls
// (count moves, count trainable, etc...) to only necesitate one loop
// TODO () => or function {}
export const rebuildChapter = (flatChapter: FlatChapter): Chapter => {
  console.log('from API', flatChapter);
  const root = rebuildMoveTree(flatChapter.moves);
  return {
    name: flatChapter.name,
    id: flatChapter.id,
    bucketEntries: flatChapter.bucketEntries,
    enabledCount: flatChapter.enabledCount,
    largestMoveId: flatChapter.largestMoveId,
    lastDueCount: flatChapter.lastDueCount,
    root: root,
    trainAs: flatChapter.trainAs,
  };
};

// provide context so moveRow[] can be reconstructed
// into tree
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

/*

  transform tree into normalized MoveRow[] to 
  simplify server-side training operations

*/
export function flattenChapter(chapter: Chapter): FlatChapter {
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
    largestMoveId: chapter.largestMoveId,
  };
}
