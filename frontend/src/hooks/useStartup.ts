//TODO how to combine with logging in manually?
//TODO useEffect on owner id switch?

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';

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
        await hydrateRepertoireFromIDB();
        return;
      }
      try {
        const res = await fetch('http://localhost:8080/repertoire', {
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
          sub: data.user.tokenId, // shouldn't have this..
          username: data.user.username,
          email: data.user.email,
          picture: data.user.picture,
        });
        void setRepertoire(parseChapters(data.chapters));
        setRepertoireAuthor(data.user.username);
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

function parseChapters(raw: any[] | undefined | null) {
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
