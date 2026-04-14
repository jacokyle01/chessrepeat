import type { Card } from 'ts-fsrs';
import type { TrainingData } from '../types/training';
import { useAuthStore } from '../state/auth';

/** Get the current user's Card from a node's training map, or null if unseen. */
export function userCard(data: TrainingData, sub?: string): Card | null {
  const key = sub ?? useAuthStore.getState().user?.sub;
  if (!key) return null;
  return data.training?.[key] ?? null;
}
