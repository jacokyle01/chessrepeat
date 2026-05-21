//TODO how to combine with logging in manually?
//TODO useEffect on owner id switch?

import { useEffect } from 'react';
import { useTrainerStore } from '../store/state';
import { fetchRepertoire } from '../services/repertoire';

/*
  Boot chessrepeat:
    - signed out: pull from indexedDB
    - signed in: hit /repertoire (via fetchRepertoire), which hydrates
      the auth store + repertoireAuthor from the response and computes
      per-chapter counts before installing.
*/

export function useStartup() {
  const updateDueCounts = useTrainerStore().updateDueCounts;
  const { hydrateRepertoireFromIDB } = useTrainerStore();

  useEffect(() => {
    const hasSessionHint = document.cookie.split('; ').some((c) => c.startsWith('chessrepeat_has_session='));
    let cancelled = false;
    /* Don't try to log-in if session hint cookie is missing */
    (async () => {
      if (!hasSessionHint) {
        await hydrateRepertoireFromIDB();
        updateDueCounts();
        return;
      }
      const result = await fetchRepertoire();
      if (cancelled) return;
      // Fall back to IDB on auth failure (stale session hint) or a
      // network error — anything else (5xx, etc.) returns silently as
      // before, no fallback.
      if (!result.ok && (result.status === 401 || result.status === undefined)) {
        await hydrateRepertoireFromIDB();
      }
      updateDueCounts();
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
