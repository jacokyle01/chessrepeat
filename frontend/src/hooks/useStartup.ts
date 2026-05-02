//TODO how to combine with logging in manually?
//TODO useEffect on owner id switch?

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { parseChapters } from '../util/chapters';

const API_URL = import.meta.env.VITE_API_URL;

/*
  Boot chessrepeat: 
    - signed out: pull from indexedDB
    - signed in: hit /repertoire and populate user and repertoire
*/

export function useStartup() {
  const setUser = useAuthStore((s) => s.setUser);
  const setRepertoireAuthor = useTrainerStore().setRepertoireAuthor;

  const { setRepertoire, hydrateRepertoireFromIDB } = useTrainerStore();

  useEffect(() => {
    const hasSessionHint = document.cookie.split('; ').some((c) => c.startsWith('chessrepeat_has_session='));
    let cancelled = false;
    /* Don't try to log-in if session hint cookie is missing */
    (async () => {
      if (!hasSessionHint) {
        // console.log("NO")
        await hydrateRepertoireFromIDB();
        return;
      }
      try {
        const res = await fetch(`${API_URL}/repertoire`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 401) await hydrateRepertoireFromIDB();
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setUser({
          username: data.user.username,
          picture: data.user.picture,
        });
        setRepertoireAuthor(data.user.username);
        void setRepertoire(parseChapters(data.chapters));
      } catch (err) {
        console.warn('bootstrap /repertoire failed', err);
        if (!cancelled) await hydrateRepertoireFromIDB();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

