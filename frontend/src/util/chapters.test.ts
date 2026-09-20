import { beforeEach, describe, expect, test } from 'vitest';
import { parseChapters } from './chapters';
import { cardDueIn, chapter, ITALIAN } from '../test/fixtures';
import { useAuthStore } from '../store/auth';

const DAY = 24 * 60 * 60 * 1000;

// Shape a fixture chapter the way the server sends it: no counts.
function wire(c: ReturnType<typeof chapter>) {
  return { uuid: c.uuid, name: c.name, trainAs: c.trainAs, root: c.root };
}

describe('parseChapters', () => {
  beforeEach(() => useAuthStore.setState({ user: { username: 'alice' } }));

  test('empty and missing input', () => {
    expect(parseChapters(undefined)).toEqual([]);
    expect(parseChapters(null)).toEqual([]);
    expect(parseChapters([])).toEqual([]);
  });

  test('derives enabled / unseen / due counts for the current user', () => {
    const c = chapter(ITALIAN, 'white');
    const e4 = c.root.children[0];
    const nf3 = e4.children[0].children[0];
    const bc4 = nf3.children[0].children[0];
    e4.data.training = cardDueIn(-1000, 'alice'); // due
    nf3.data.training = cardDueIn(DAY, 'alice'); // seen, not due
    bc4.data.training = cardDueIn(-1000, 'bob'); // someone else's card: unseen for alice

    const [out] = parseChapters([wire(c)]);
    expect(out.uuid).toBe(c.uuid);
    expect(out.name).toBe(c.name);
    expect(out.trainAs).toBe('white');
    expect(out.enabledCount).toBe(3);
    expect(out.unseenCount).toBe(1);
    expect(out.lastDueCount).toBe(1);
  });

  test('preserves order and handles several chapters', () => {
    const a = chapter(ITALIAN, 'white', 'a');
    const b = chapter(ITALIAN, 'black', 'b');
    const out = parseChapters([wire(a), wire(b)]);
    expect(out.map((c) => c.name)).toEqual(['a', 'b']);
    expect(out[1].enabledCount).toBe(3);
    expect(out[1].unseenCount).toBe(3);
  });
});
