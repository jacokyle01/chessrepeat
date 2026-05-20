import type { Chapter } from '../types/training';

// Shapes the server's chapters array into the frontend Chapter type used by
// the trainer store. Used by the /repertoire bootstrap and the /login reply.
export function parseChapters(raw: any[] | undefined | null): Chapter[] {
  // Counts are no longer sent by the server. fetchRepertoire walks each
  // chapter and computes enabled / unseen / due before installing — we
  // just initialize to 0 here so the fields are always defined.
  return (raw ?? []).map((c: any) => ({
    uuid: c.uuid,
    name: c.name,
    trainAs: c.trainAs,
    root: c.root,
    enabledCount: 0,
    unseenCount: 0,
    lastDueCount: 0,
  }));
}
