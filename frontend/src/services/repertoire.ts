import { parseChapters } from '../util/chapters';
import { useTrainerStore } from '../store/state';
import { useAuthStore } from '../store/auth';

const API = import.meta.env.VITE_API_URL;

export type FetchRepertoireResult = {
  ok: boolean;
  // HTTP status when the response came back; undefined for network/JSON errors.
  status?: number;
};

// Pull the authoritative repertoire from the server and install it as
// the in-memory state. parseChapters handles both the JSON shaping and
// the per-chapter count derivation (enabled / unseen / due) — the
// server no longer persists those, they're a function of the tree and
// the current user's SRS cards. Used by:
//   - useStartup, as the bootstrap fetch.
//   - the ws 'reload' handler, to recover from server-detected drift.
//   - addMove / deleteLine / setCommentAt / postChapter, when a local or
//     server-side path lookup fails and we need to resync.
//
// The WebSocket room is left untouched (we're resyncing, not switching
// owners). On the bootstrap call there's no repertoireAuthor yet; the
// server response carries the session's user, so we hydrate auth and
// author from it before installing the chapters.
export async function fetchRepertoire(): Promise<FetchRepertoireResult> {
  const store = useTrainerStore.getState();
  const { repertoireAuthor } = store;
  const url = repertoireAuthor
    ? `${API}/repertoire?owner=${encodeURIComponent(repertoireAuthor)}`
    : `${API}/repertoire`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      console.warn('fetchRepertoire: http', res.status);
      return { ok: false, status: res.status };
    }
    const data = await res.json();

    // Bootstrap-only: no repertoireAuthor means this is the first fetch
    // after a page load. The /repertoire response is the canonical place
    // to learn who the session belongs to.
    if (!repertoireAuthor && data?.user?.username) {
      useAuthStore.getState().setUser({
        username: data.user.username,
        picture: data.user.picture,
      });
      store.setRepertoireAuthor(data.user.username);
    }

    await useTrainerStore.getState().setRepertoire(parseChapters(data.chapters));
    return { ok: true, status: res.status };
  } catch (err) {
    console.warn('fetchRepertoire: failed', err);
    return { ok: false };
  }
}
