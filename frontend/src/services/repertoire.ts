import { parseChapters } from '../util/chapters';
import { useTrainerStore } from '../store/state';

const API = import.meta.env.VITE_API_URL;

// Re-fetch the currently-viewed repertoire over HTTP and replace the
// in-memory tree. Used to recover from client/server tree drift: either
// the server rejected a mutation against a path it doesn't have and told
// us to reload, or addMove found its anchor path missing locally. We
// re-fetch the same owner we're currently viewing; the WebSocket room is
// left untouched (we're resyncing, not switching repertoires).
export async function reloadRepertoire(): Promise<void> {
  const { repertoireAuthor } = useTrainerStore.getState();
  const url = repertoireAuthor
    ? `${API}/repertoire?owner=${encodeURIComponent(repertoireAuthor)}`
    : `${API}/repertoire`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      console.warn('reloadRepertoire: http', res.status);
      return;
    }
    const data = await res.json();
    await useTrainerStore.getState().setRepertoire(parseChapters(data.chapters));
  } catch (err) {
    console.warn('reloadRepertoire: failed', err);
  }
}
