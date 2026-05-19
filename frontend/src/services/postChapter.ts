import type { Chapter } from '../types/training';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';

const API = import.meta.env.VITE_API_URL;

// Persists a new chapter via HTTP POST /chapter. The full move tree is
// far larger than the WebSocket frame cap, so it must not go over the
// socket. The server stamps the owner from the session/owner param,
// persists, and then broadcasts a 'reload' to the owner's room — every
// connected peer (including this user's other tabs) resyncs over HTTP.
// The creating tab already added the chapter locally for instant
// feedback; the broadcast reload just reconciles it with the
// authoritative (possibly cap-trimmed) server state.
export async function postChapter(chapter: Chapter): Promise<void> {
  const { user } = useAuthStore.getState();
  const { repertoireAuthor } = useTrainerStore.getState();
  if (!user?.username || !repertoireAuthor) {
    console.error('postChapter: not authenticated or no author');
    return;
  }

  try {
    const res = await fetch(`${API}/chapter?owner=${encodeURIComponent(repertoireAuthor)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterId: chapter.uuid,
        name: chapter.name,
        trainAs: chapter.trainAs,
        root: chapter.root,
        enabledCount: chapter.enabledCount,
        unseenCount: chapter.unseenCount,
      }),
    });
    if (!res.ok) {
      // 413 => over the per-chapter move cap; other codes => transient.
      // Either way the local copy is now divergent: resync from server.
      console.error('postChapter: http', res.status);
      const { reloadRepertoire } = await import('./repertoire');
      await reloadRepertoire();
    }
  } catch (err) {
    console.error('postChapter: failed', err);
  }
}
