export type PersistedMoveNode = {
  id: string;
  parentId: string | null;
  ply: number;
  san: string;
  // optional: omit fen to save space, compute/cached in-memory
  fen?: string;

  training: {
    disabled: boolean;
    seen: boolean;
    group: number;
    dueAt: number;
  };

  comment: string | null;

  // normalized edges
  childrenIds: string[];
};

export type PersistedChapterMeta = {
  id: string;
  name: string;
  trainAs: 'white' | 'black';
  rootId: string;
  enabledCount: number;
  bucketEntries: number[];
  updatedAt: number;
  lastDueCount: number;
};
