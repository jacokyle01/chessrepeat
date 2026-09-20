import { beforeEach, describe, expect, test } from 'vitest';
import { userCard } from './userCard';
import { PLAYGROUND_KEY, useAuthStore } from '../store/auth';
import { cardDueIn, node } from '../test/fixtures';

describe('userCard', () => {
  beforeEach(() => useAuthStore.setState({ user: null }));

  test('signed out reads the playground card', () => {
    const n = node('e4', { training: { ...cardDueIn(0), ...cardDueIn(0, 'alice') } });
    expect(userCard(n.data)).toBe(n.data.training[PLAYGROUND_KEY]);
  });

  test('signed in reads the card keyed by username', () => {
    useAuthStore.setState({ user: { username: 'alice' } });
    const n = node('e4', { training: { ...cardDueIn(0), ...cardDueIn(0, 'alice') } });
    expect(userCard(n.data)).toBe(n.data.training.alice);
  });

  test('an explicit username wins over the session', () => {
    useAuthStore.setState({ user: { username: 'alice' } });
    const n = node('e4', { training: cardDueIn(0, 'bob') });
    expect(userCard(n.data, 'bob')).toBe(n.data.training.bob);
    expect(userCard(n.data)).toBeNull();
  });

  test('no card, or no training map at all, is null', () => {
    expect(userCard(node('e4').data)).toBeNull();
    expect(userCard({ ...node('e4').data, training: undefined as any })).toBeNull();
  });
});
