import type { Chapter } from '../types/training';

// Shapes the server's chapters array into the frontend Chapter type used by
// the trainer store. Used by the /repertoire bootstrap and the /login reply.
export function parseChapters(raw: any[] | undefined | null): Chapter[] {
  return (raw ?? []).map((c: any) => ({
    uuid: c.uuid,
    name: c.name,
    trainAs: c.trainAs,
    root: c.root,
    enabledCount: c.enabledCount,
    unseenCount: c.unseenCount,
    lastDueCount: 0,
  }));
}
