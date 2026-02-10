// import PouchDB from 'pouchdb-browser';
// import { Chapter, TrainableNode } from '../types/training';
// import { ChapterMetaDoc, IndexDoc, NodeDoc } from '../types/couch';

// export function makeLocalDB(sub: string) {
//   return new PouchDB(`chessrepeat_local_${sub}`);
// }

// // Remote is the user’s CouchDB database (or filtered endpoint).
// export function makeRemoteDB(remoteDbUrl: string) {
//   return new PouchDB(remoteDbUrl, {
//     skip_setup: false,
//     // If you use cookie auth:
//     // fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' })
//   });
// }

// export function startPushOnlySync(local: PouchDB.Database, remote: PouchDB.Database) {
//   const h = local.replicate.to(remote, { live: true, retry: true });
//   h.on('error', (e) => console.error('replicate.to error', e));
//   return () => h.cancel();
// }

// //TODO better conflict handling or lack thereof?
// export const idChapter = (sub: string, chapterId: string) => `chapter:${sub}:${chapterId}`;
// export const idNode = (sub: string, chapterId: string, idx: number) => `node:${sub}:${chapterId}:${idx}`;
// export const idIndex = (sub: string) => `index:${sub}`;

// export async function upsertWithRetry<T extends { _id: string; _rev?: string }>(
//   db: PouchDB.Database,
//   docId: string,
//   mutate: (current: T | null) => T,
//   tries = 5,
// ): Promise<void> {
//   for (let i = 0; i < tries; i++) {
//     try {
//       let current: T | null = null;
//       try {
//         current = await db.get<T>(docId);
//       } catch (e: any) {
//         if (e.status !== 404) throw e;
//       }
//       const next = mutate(current);
//       if (current?._rev) next._rev = current._rev;
//       await db.put(next);
//       return;
//     } catch (e: any) {
//       if (e.status === 409) continue;
//       throw e;
//     }
//   }
//   throw new Error(`Failed upsertWithRetry(${docId}) after retries`);
// }

// export type FlatNode = Omit<NodeDoc, '_id' | '_rev' | 'type' | 'sub' | 'chapterId' | 'updatedAt'>;

// export function buildTreeFromFlatNodes(meta: ChapterMetaDoc, nodes: NodeDoc[]): Chapter {
//   // Map idx -> TrainableNode
//   const map = new Map<number, TrainableNode>();

//   for (const n of nodes) {
//     map.set(n.idx, {
//       data: {
//         training: { ...n.training },
//         ply: n.ply,
//         id: n.id,
//         idx: n.idx,
//         san: n.san,
//         fen: n.fen,
//         comment: n.comment ?? '',
//       },
//       children: [],
//     });
//   }

//   // Attach children by parentIdx and ord
//   for (const n of nodes) {
//     const node = map.get(n.idx)!;
//     if (n.parentIdx == null) continue;
//     const parent = map.get(n.parentIdx);
//     if (!parent) continue; // orphan safety
//     parent.children[n.ord] = node;
//   }

//   // compact holes in child arrays
//   for (const node of map.values()) {
//     node.children = node.children.filter(Boolean);
//   }

//   // root is the one with parentIdx == null (usually idx=0)
//   const rootDoc = nodes.find((x) => x.parentIdx == null);
//   const root = rootDoc ? map.get(rootDoc.idx)! : ([...map.values()][0] ?? null);

//   return {
//     id: meta.chapterId,
//     name: meta.name,
//     lastDueCount: meta.lastDueCount,
//     trainAs: meta.trainAs,
//     enabledCount: meta.enabledCount,
//     bucketEntries: meta.bucketEntries,
//     largestMoveId: meta.largestMoveId,
//     root,
//   };
// }

// export async function loadAllChapters(db: PouchDB.Database, sub: string): Promise<Chapter[]> {
//   // 1) get index
//   let idxDoc: IndexDoc | null = null;
//   try {
//     idxDoc = await db.get<IndexDoc>(idIndex(sub));
//   } catch (e: any) {
//     if (e.status !== 404) throw e;
//   }
//   const ids = idxDoc?.chapterIds ?? [];
//   if (!ids.length) return [];

//   // 2) fetch meta docs
//   const metaRes = await db.allDocs<ChapterMetaDoc>({
//     keys: ids.map((cid) => idChapter(sub, cid)),
//     include_docs: true,
//   });

//   const chapters: Chapter[] = [];

//   for (const row of metaRes.rows) {
//     const meta = row.doc;
//     if (!meta) continue;

//     // 3) fetch nodes for chapter (prefix query)
//     const nodesRes = await db.allDocs<NodeDoc>({
//       include_docs: true,
//       startkey: `node:${sub}:${meta.chapterId}:`,
//       endkey: `node:${sub}:${meta.chapterId}:\ufff0`,
//     });
//     const nodes = nodesRes.rows.map((r) => r.doc).filter(Boolean) as NodeDoc[];
//     chapters.push(buildTreeFromFlatNodes(meta, nodes));
//   }

//   return chapters;
// }


// export type DbState = {
//   sub: string | null;
//   localDb: PouchDB.Database | null;
//   remoteDb: PouchDB.Database | null;
//   stopSync: null | (() => void);
// };



import PouchDB from 'pouchdb';
import PouchIdb from 'pouchdb-adapter-idb';

PouchDB.plugin(PouchIdb);

// Optional: type helper
export type Pouch = PouchDB.Database;

export function makeLocalDB(name: string) {
  // Force IndexedDB adapter explicitly
  return new PouchDB(name, { adapter: 'idb' });
}