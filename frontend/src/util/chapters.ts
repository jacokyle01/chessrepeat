import type { Chapter } from '../types/training';
import { forEachNode } from './tree';
import { userCard } from './userCard';

// Shapes the server's chapters array into the frontend Chapter type
// used by the trainer store, and computes the per-chapter counts
// (enabled / unseen / due) in the same pass. The server no longer
// persists those counts, so they're a function of the move tree +
// node.data.enabled (driven by trainAs) + the current user's SRS
// cards, and have to be rebuilt every time chapters arrive over the
// wire. Used by fetchRepertoire and the /login reply.
export function parseChapters(raw: any[] | undefined | null): Chapter[] {
  const now = Date.now();
  return (raw ?? []).map((c: any) => {
    const chapter: Chapter = {
      uuid: c.uuid,
      name: c.name,
      trainAs: c.trainAs,
      root: c.root,
      enabledCount: 0,
      unseenCount: 0,
      lastDueCount: 0,
    };
    forEachNode(chapter.root, (node) => {
      if (!node.data.enabled) return;
      chapter.enabledCount++;
      const card = userCard(node.data);
      if (!card) {
        chapter.unseenCount++;
        return;
      }
      if (new Date(card.due).getTime() < now) chapter.lastDueCount++;
    });
    return chapter;
  });
}
