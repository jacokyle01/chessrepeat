import type { Card } from 'ts-fsrs';
import type { TrainingData } from '../types/training';
import { PLAYGROUND_KEY, useAuthStore } from '../store/auth';

// Read the current user's SRS card from a node's training map. The map
// is keyed by username for signed-in users (server stamps it from the
// session) and by PLAYGROUND_KEY for the local-only playground.
export function userCard(data: TrainingData, username?: string): Card | null {
  const auth = useAuthStore.getState();
  const key = username ?? auth.user?.username ?? (!auth.isAuthenticated() ? PLAYGROUND_KEY : null);
  if (!key) return null;
  return data.training?.[key] ?? null;
}
