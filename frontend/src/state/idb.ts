/*
  Repertoire meta will be stored as usual (to be used by repertoire UI), but chapters will be stored on their own, 
  with nodes being stored as a flattened array 



*/

// persisted node (normalized)
// TODO we can optionally remove some of these fields and create them dynamically, on refresh

const KEYS = {
  metaIndex: 'trainer:chapters', // array of PersistedChapterMeta
  chapterMeta: (cid: string) => `trainer:meta:${cid}`,
  node: (cid: string, nid: string) => `trainer:node:${cid}:${nid}`,
  // optional helper index for quick iteration (node ids)
  nodeIds: (cid: string) => `trainer:nodeIds:${cid}`, // string[]
};

import { get as idbGet, set as idbSet, del as idbDel, get, set } from 'idb-keyval';

function createWriteQueue(delayMs = 400) {
  const pending = new Map<string, any>();
  let timer: number | null = null;

  const flush = async () => {
    timer = null;
    const batch = Array.from(pending.entries());
    pending.clear();
    await Promise.all(batch.map(([k, v]) => idbSet(k, v)));
  };

  return {
    put(key: string, value: any) {
      pending.set(key, value);
      if (timer) clearTimeout(timer);
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void) => void);
      if (ric) ric(flush);
      else timer = window.setTimeout(flush, delayMs);
    },
    async putNow(key: string, value: any) {
      pending.delete(key);
      await idbSet(key, value);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await flush();
    },
  };
}

const wq = createWriteQueue(800);

export const movesDB = {
  // ---- meta index ----
  async getAllChapterMeta(): Promise<PersistedChapterMeta[]> {
    return (await idbGet(KEYS.metaIndex)) ?? [];
  },
  async setAllChapterMeta(list: PersistedChapterMeta[]) {
    wq.put(KEYS.metaIndex, list);
  },
  async setChapterMeta(meta: PersistedChapterMeta) {
    wq.put(KEYS.chapterMeta(meta.id), meta);
  },
  async getChapterMeta(chapterId: string): Promise<PersistedChapterMeta | null> {
    return (await idbGet(KEYS.chapterMeta(chapterId))) ?? null;
  },

  // ---- nodes ----
  async getNode(chapterId: string, nodeId: string): Promise<PersistedMoveNode | null> {
    return (await idbGet(KEYS.node(chapterId, nodeId))) ?? null;
  },
  setNode(chapterId: string, node: PersistedMoveNode) {
    wq.put(KEYS.node(chapterId, node.id), node);
  },

  async patchNode(
    chapterId: string,
    nodeId: string,
    patch: Partial<PersistedMoveNode> | ((prev: PersistedMoveNode) => PersistedMoveNode),
  ) {
    const prev = await movesDB.getNode(chapterId, nodeId);
    if (!prev) return;
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
    wq.put(KEYS.node(chapterId, nodeId), next);
  },

  async addChild(chapterId: string, parentId: string, childId: string) {
    await movesDB.patchNode(chapterId, parentId, (prev) => {
      if (prev.childrenIds.includes(childId)) return prev;
      return { ...prev, childrenIds: [...prev.childrenIds, childId] };
    });
  },

  // optional nodeIds list to speed up “load all nodes”
  async getNodeIds(chapterId: string): Promise<string[]> {
    return (await idbGet(KEYS.nodeIds(chapterId))) ?? [];
  },
  setNodeIds(chapterId: string, ids: string[]) {
    wq.put(KEYS.nodeIds(chapterId), ids);
  },

  async deleteChapter(chapterId: string) {
    // remove nodes
    const ids = await movesDB.getNodeIds(chapterId);
    await Promise.all(ids.map((nid) => idbDel(KEYS.node(chapterId, nid))));
    await idbDel(KEYS.nodeIds(chapterId));

    // remove per-chapter meta
    await idbDel(KEYS.chapterMeta(chapterId));

    // remove from meta index
    const all = await movesDB.getAllChapterMeta();
    const next = all.filter((m) => m.id !== chapterId);
    await wq.putNow(KEYS.metaIndex, next);
  },
};

import type { Chapter, TrainableNode, TrainingData } from '../types/training';
import { ChildNode } from 'chessops/pgn';
import { PersistedChapterMeta, PersistedMoveNode } from '../types/state';

// We need to convert indexedDB node record into a tree
// TODO how do we get the root?
function persistedToRuntimeNode(p: PersistedMoveNode): ChildNode<TrainingData> {
  // console.log("persisted node", p);
  return {
    data: {
      id: p.id,
      ply: p.ply,
      san: p.san,
      fen: p.fen ?? '', // or compute later
      comment: p.comment ?? '',
      training: { ...p.training },
    } as any,
    children: [],
  };
}

export async function loadChapterRuntime(chapterId: string): Promise<Chapter | null> {
  const meta = await movesDB.getChapterMeta(chapterId);
  if (!meta) return null;

  const ids = await movesDB.getNodeIds(chapterId);
  const nodes = await Promise.all(ids.map((id) => movesDB.getNode(chapterId, id)));
  const present = nodes.filter(Boolean) as PersistedMoveNode[];

  const byId = new Map<string, ChildNode<TrainingData>>();
  for (const p of present) byId.set(p.id, persistedToRuntimeNode(p));

  // link children
  for (const p of present) {
    const parent = byId.get(p.id)!;
    parent.children = p.childrenIds.map((cid) => byId.get(cid)!).filter(Boolean);
  }

  const root = byId.get(meta.rootId);
  if (!root) return null;

  console.log('root', root);
  return {
    id: meta.id,
    name: meta.name,
    trainAs: meta.trainAs,
    root,
    nodeCount: meta.nodeCount,
    bucketEntries: meta.bucketEntries,
    lastDueCount: 0,
  } as any;
}

export async function getChapterMetaFromIDB(): Promise<PersistedChapterMeta[]> {
  return (await idbGet(KEYS.metaIndex)) ?? [];
}

export async function setChapterMetaInIDB(next: PersistedChapterMeta[]): Promise<void> {
  // meta index is small — write immediately so refresh works
  await wq.putNow(KEYS.metaIndex, next);
}

// can be called on importing a chapter- create & store a normalized move record in idb

export async function persistFullChapter(ch: Chapter) {
  // ✅ FIX: declare nodeIds
  const nodeIds: string[] = [];

  // DFS stack
  const stack: Array<{ node: TrainableNode; parentId: string | null }> = [{ node: ch.root, parentId: null }];

  while (stack.length) {
    const { node, parentId } = stack.pop()!;
    nodeIds.push(node.data.id);

    const persisted: PersistedMoveNode = {
      id: node.data.id,
      parentId,
      ply: node.data.ply,
      san: node.data.san,
      // TODO fen optional?
      fen: node.data.fen, 
      training: { ...node.data.training },
      comment: node.data.comment ?? null,
      childrenIds: node.children.map((c) => c.data.id),
    };

    // nodes can be queued (large data)
    movesDB.setNode(ch.id, persisted);

    for (const child of node.children) {
      stack.push({ node: child, parentId: node.data.id });
    }
  }

  const meta: PersistedChapterMeta = {
    id: ch.id,
    name: ch.name,
    trainAs: ch.trainAs,
    rootId: ch.root.data.id,
    nodeCount: ch.nodeCount,
    bucketEntries: ch.bucketEntries,
    updatedAt: Date.now(),
    lastDueCount: ch.lastDueCount,
  };

  // ✅ Meta + index MUST be durable immediately
  await wq.putNow(KEYS.chapterMeta(ch.id), meta);
  await wq.putNow(KEYS.nodeIds(ch.id), nodeIds);

  // update meta index list
  const all = await movesDB.getAllChapterMeta();
  const next = [...all.filter((m) => m.id !== ch.id), meta];

  await wq.putNow(KEYS.metaIndex, next);
}

// newState/persistChapter.ts
export async function deleteFullChapter(chapterId: string) {
  await movesDB.deleteChapter(chapterId);
}
