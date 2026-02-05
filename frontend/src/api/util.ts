// todo move somewhere else

export type TreeNodeRebuilt = TrainingData & { children: TreeNodeRebuilt[] };

export function rebuildMoveTree(rows: MoveRow[]): TreeNodeRebuilt {
  const byId = new Map<string, TreeNodeRebuilt>();
  const childrenByParent = new Map<string | null, MoveRow[]>();

  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      fen: r.fen,
      ply: r.ply,
      san: r.san,
      comment: r.comment,
      training: r.training,
      children: [],
    });
    const list = childrenByParent.get(r.parentIdx) ?? [];
    list.push(r);
    childrenByParent.set(r.parentIdx, list);
  }

  // sort each sibling list by ord
  for (const [k, list] of childrenByParent.entries()) {
    list.sort((a, b) => a.ord - b.ord);
    childrenByParent.set(k, list);
  }

  const roots = childrenByParent.get(null) ?? [];
  if (roots.length !== 1) {
    throw new Error(`Expected exactly 1 root, got ${roots.length}`);
  }

  const rootRow = roots[0];
  const root = byId.get(rootRow.id)!;

  function attach(parentIdx: number) {
    const kids = childrenByParent.get(parentIdx) ?? [];
    const parent = byId.get(parentIdx)!;
    parent.children = kids.map((k) => byId.get(k.id)!);
    for (const k of kids) attach(k.id);
  }

  attach(rootRow.id);
  return root;
}
