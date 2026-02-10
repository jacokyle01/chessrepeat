// frontend/src/lib/database.ts
// Database utilities for PouchDB operations

import PouchDB from 'pouchdb';

// ============================================================================
// Type Definitions
// ============================================================================

export type Color = 'white' | 'black';

export interface TrainingData {
  training: {
    disabled: boolean;
    seen: boolean;
    group: number;
    dueAt: number;
  };
  id: string;
  idx: number;
  fen: string;
  ply: number;
  san: string;
  comment: string;
}

export interface TrainableNode {
  data: TrainingData;
  children: TrainableNode[];
}

export interface Chapter {
  name: string;
  id: string;
  lastDueCount: number;
  trainAs: Color;
  enabledCount: number;
  bucketEntries: number[];
  root: TrainableNode;
  largestMoveId: number;
}

// Database document types
export interface IndexDoc {
  _id: 'index';
  _rev?: string;
  type: 'index';
  chapterIds: string[];
  updatedAt: number;
}

export interface ChapterMetaDoc {
  _id: string;  // `chapter:${chapterId}`
  _rev?: string;
  type: 'chapter_meta';
  chapterId: string;
  name: string;
  trainAs: Color;
  largestMoveId: number;
  updatedAt: number;
}

export interface NodeDoc {
  _id: string;  // `node:${chapterId}:${idx}`
  _rev?: string;
  type: 'node';
  chapterId: string;
  idx: number;
  parentIdx: number;
  ord: number;  // order among siblings
  
  // Training data
  training: {
    disabled: boolean;
    seen: boolean;
    group: number;
    dueAt: number;
  };
  
  // Chess data
  id: string;
  fen: string;
  ply: number;
  san: string;
  comment: string;
}

// ============================================================================
// Tree Flattening and Reconstruction
// ============================================================================

/**
 * Flatten a tree into an array of NodeDoc documents
 */
export function flattenTree(
  chapterId: string,
  root: TrainableNode
): NodeDoc[] {
  const nodeDocs: NodeDoc[] = [];
  
  function traverse(node: TrainableNode, parentIdx: number, ord: number) {
    // Skip the synthetic root node (idx: -1)
    if (node.data.idx !== -1) {
      const nodeDoc: NodeDoc = {
        _id: `node:${chapterId}:${node.data.idx}`,
        type: 'node',
        chapterId,
        idx: node.data.idx,
        parentIdx,
        ord,
        training: node.data.training,
        id: node.data.id,
        fen: node.data.fen,
        ply: node.data.ply,
        san: node.data.san,
        comment: node.data.comment,
      };
      
      nodeDocs.push(nodeDoc);
    }
    
    // Recursively process children
    node.children.forEach((child, index) => {
      traverse(child, node.data.idx, index);
    });
  }
  
  traverse(root, -1, 0);
  return nodeDocs;
}

/**
 * Reconstruct a tree from flat NodeDoc array
 */
export function reconstructTree(nodeDocs: NodeDoc[]): TrainableNode {
  // Create a map of idx -> node for quick lookup
  const nodeMap = new Map<number, TrainableNode>();
  
  // Create synthetic root
  const root: TrainableNode = {
    data: {
      training: {
        disabled: false,
        seen: false,
        group: -1,
        dueAt: -1,
      },
      id: '',
      idx: -1,
      fen: '',
      ply: 0,
      san: '',
      comment: '',
    },
    children: [],
  };
  
  nodeMap.set(-1, root);
  
  // First pass: create all nodes
  for (const doc of nodeDocs) {
    const node: TrainableNode = {
      data: {
        training: doc.training,
        id: doc.id,
        idx: doc.idx,
        fen: doc.fen,
        ply: doc.ply,
        san: doc.san,
        comment: doc.comment,
      },
      children: [],
    };
    
    nodeMap.set(doc.idx, node);
  }
  
  // Second pass: build parent-child relationships
  // Sort by ord to maintain correct child order
  const sortedDocs = [...nodeDocs].sort((a, b) => {
    if (a.parentIdx !== b.parentIdx) {
      return a.parentIdx - b.parentIdx;
    }
    return a.ord - b.ord;
  });
  
  for (const doc of sortedDocs) {
    const parent = nodeMap.get(doc.parentIdx);
    const child = nodeMap.get(doc.idx);
    
    if (parent && child) {
      parent.children.push(child);
    }
  }
  
  return root;
}

/**
 * Calculate derived metadata from nodes
 */
export function calculateDerivedMetadata(
  nodeDocs: NodeDoc[],
  bucketCount: number = 10
): {
  lastDueCount: number;
  enabledCount: number;
  bucketEntries: number[];
} {
  let enabledCount = 0;
  const bucketEntries = new Array(bucketCount).fill(0);
  let lastDueCount = 0;
  const now = Math.floor(Date.now() / 1000);
  
  for (const node of nodeDocs) {
    if (!node.training.disabled) {
      enabledCount++;
      
      if (node.training.seen) {
        bucketEntries[node.training.group]++;
        
        if (node.training.dueAt <= now) {
          lastDueCount++;
        }
      }
    }
  }
  
  return { lastDueCount, enabledCount, bucketEntries };
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Load all chapters from database
 */
export async function loadAllChapters(db: PouchDB.Database): Promise<Chapter[]> {
  try {
    // Get index document
    const indexDoc = await db.get<IndexDoc>('index');
    const chapters: Chapter[] = [];
    
    // Load each chapter
    for (const chapterId of indexDoc.chapterIds) {
      const chapter = await loadChapter(db, chapterId);
      if (chapter) {
        chapters.push(chapter);
      }
    }
    
    return chapters;
  } catch (err) {
    if ((err as any).status === 404) {
      // No index yet, return empty array
      return [];
    }
    throw err;
  }
}

/**
 * Load a single chapter from database
 */
export async function loadChapter(
  db: PouchDB.Database,
  chapterId: string
): Promise<Chapter | null> {
  try {
    // Load chapter metadata
    const metaDoc = await db.get<ChapterMetaDoc>(`chapter:${chapterId}`);
    
    // Load all nodes for this chapter
    const result = await db.allDocs<NodeDoc>({
      include_docs: true,
      startkey: `node:${chapterId}:`,
      endkey: `node:${chapterId}:\ufff0`,
    });
    
    const nodeDocs = result.rows
      .map(row => row.doc!)
      .filter(doc => doc.type === 'node');
    
    // Reconstruct tree
    const root = reconstructTree(nodeDocs);
    
    // Calculate derived metadata
    const derived = calculateDerivedMetadata(nodeDocs);
    
    return {
      name: metaDoc.name,
      id: metaDoc.chapterId,
      trainAs: metaDoc.trainAs,
      largestMoveId: metaDoc.largestMoveId,
      root,
      ...derived,
    };
  } catch (err) {
    console.error(`Failed to load chapter ${chapterId}:`, err);
    return null;
  }
}

/**
 * Save a chapter to database
 */
export async function saveChapter(
  db: PouchDB.Database,
  chapter: Chapter
): Promise<void> {
  // Save chapter metadata
  const metaDocId = `chapter:${chapter.id}`;
  const metaDoc: ChapterMetaDoc = {
    _id: metaDocId,
    type: 'chapter_meta',
    chapterId: chapter.id,
    name: chapter.name,
    trainAs: chapter.trainAs,
    largestMoveId: chapter.largestMoveId,
    updatedAt: Date.now(),
  };
  
  try {
    const existing = await db.get(metaDocId);
    metaDoc._rev = existing._rev;
  } catch (err) {
    // Document doesn't exist yet, that's fine
  }
  
  await db.put(metaDoc);
  
  // Flatten and save nodes
  const nodeDocs = flattenTree(chapter.id, chapter.root);
  
  // Fetch existing nodes to preserve _rev
  const existingNodes = await db.allDocs({
    keys: nodeDocs.map(n => n._id),
  });
  
  const docsToSave = nodeDocs.map((doc, index) => {
    const existingRow = existingNodes.rows[index];
    if (existingRow && !existingRow.error && existingRow.value) {
      return { ...doc, _rev: existingRow.value.rev };
    }
    return doc;
  });
  
  // Bulk save all nodes
  await db.bulkDocs(docsToSave);
  
  // Update index
  await updateIndex(db, chapter.id);
}

/**
 * Delete a chapter from database
 */
export async function deleteChapter(
  db: PouchDB.Database,
  chapterId: string
): Promise<void> {
  // Delete metadata
  try {
    const metaDoc = await db.get(`chapter:${chapterId}`);
    await db.remove(metaDoc);
  } catch (err) {
    console.error('Failed to delete chapter metadata:', err);
  }
  
  // Delete all nodes
  const result = await db.allDocs({
    include_docs: true,
    startkey: `node:${chapterId}:`,
    endkey: `node:${chapterId}:\ufff0`,
  });
  
  const docsToDelete = result.rows.map(row => ({
    ...row.doc,
    _deleted: true,
  }));
  
  if (docsToDelete.length > 0) {
    await db.bulkDocs(docsToDelete);
  }
  
  // Update index
  await removeFromIndex(db, chapterId);
}

/**
 * Update the index document
 */
async function updateIndex(db: PouchDB.Database, chapterId: string): Promise<void> {
  try {
    const indexDoc = await db.get<IndexDoc>('index');
    
    if (!indexDoc.chapterIds.includes(chapterId)) {
      indexDoc.chapterIds.push(chapterId);
      indexDoc.updatedAt = Date.now();
      await db.put(indexDoc);
    }
  } catch (err) {
    if ((err as any).status === 404) {
      // Create new index
      await db.put<IndexDoc>({
        _id: 'index',
        type: 'index',
        chapterIds: [chapterId],
        updatedAt: Date.now(),
      });
    } else {
      throw err;
    }
  }
}

/**
 * Remove chapter from index
 */
async function removeFromIndex(db: PouchDB.Database, chapterId: string): Promise<void> {
  try {
    const indexDoc = await db.get<IndexDoc>('index');
    indexDoc.chapterIds = indexDoc.chapterIds.filter(id => id !== chapterId);
    indexDoc.updatedAt = Date.now();
    await db.put(indexDoc);
  } catch (err) {
    console.error('Failed to update index:', err);
  }
}

/**
 * Save a single node (for incremental updates)
 */
export async function saveNode(
  db: PouchDB.Database,
  chapterId: string,
  node: TrainableNode,
  parentIdx: number,
  ord: number
): Promise<void> {
  const nodeDoc: NodeDoc = {
    _id: `node:${chapterId}:${node.data.idx}`,
    type: 'node',
    chapterId,
    idx: node.data.idx,
    parentIdx,
    ord,
    training: node.data.training,
    id: node.data.id,
    fen: node.data.fen,
    ply: node.data.ply,
    san: node.data.san,
    comment: node.data.comment,
  };
  
  try {
    const existing = await db.get(nodeDoc._id);
    nodeDoc._rev = existing._rev;
  } catch (err) {
    // Document doesn't exist yet
  }
  
  await db.put(nodeDoc);
}

/**
 * Update chapter metadata only
 */
export async function updateChapterMetadata(
  db: PouchDB.Database,
  chapterId: string,
  updates: Partial<Pick<Chapter, 'name' | 'largestMoveId'>>
): Promise<void> {
  const metaDocId = `chapter:${chapterId}`;
  const metaDoc = await db.get<ChapterMetaDoc>(metaDocId);
  
  const updatedDoc: ChapterMetaDoc = {
    ...metaDoc,
    ...updates,
    updatedAt: Date.now(),
  };
  
  await db.put(updatedDoc);
}

/**
 * Upsert helper with retry logic
 */
export async function upsertDoc<T extends { _id: string; _rev?: string }>(
  db: PouchDB.Database,
  docId: string,
  updateFn: (current: T | null) => T,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      let current: T | null = null;
      
      try {
        current = await db.get<T>(docId);
      } catch (err) {
        if ((err as any).status !== 404) throw err;
      }
      
      const updated = updateFn(current);
      const result = await db.put(updated);
      
      return { ...updated, _rev: result.rev };
    } catch (err) {
      if ((err as any).status === 409 && i < maxRetries - 1) {
        // Conflict, retry
        continue;
      }
      throw err;
    }
  }
  
  throw new Error(`Failed to upsert document ${docId} after ${maxRetries} retries`);
}