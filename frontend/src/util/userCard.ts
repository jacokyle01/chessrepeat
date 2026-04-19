import type { Card } from 'ts-fsrs';
import type { TrainingData } from '../types/training';
import { PLAYGROUND_SUB, useAuthStore } from '../store/auth';

/** Get the current user's Card from a node's training map, or null if unseen. */
export function userCard(data: TrainingData, sub?: string): Card | null {
  const auth = useAuthStore.getState();
  const key = sub ?? auth.user?.sub ?? (auth.isPlayground() ? PLAYGROUND_SUB : null);
  if (!key) return null;
  return data.training?.[key] ?? null;
}
