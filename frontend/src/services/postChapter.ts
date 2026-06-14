import type { Chapter } from '../types/training';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { fetchRepertoire } from './repertoire';

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
      }),
    });
    if (res.status == 413) {
      // 413 => over the per-chapter move cap; other codes => transient.
      // Either way the local copy is now divergent: resync from server.
      alert('Chapter exceeds move cap. Email jacokyle01@gmail.com to request extra capacity');
      // fetch actual state
      await fetchRepertoire();
    } else if (res.status == 409) {
      // 409 => chapter exceeds per-repertoire chapter cap
      alert('Repertoire exceeds chapter limit. Email jacokyle01@gmail.com to request extra capacity');
      // fetch actual state
      await fetchRepertoire();
    } else {
      console.error(res.text, 'unexpected error occured...');
    }
  } catch (err) {
    console.error('postChapter: failed', err);
  }
}
