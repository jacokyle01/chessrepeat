import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// In-memory stand-in for IndexedDB. Everything the store persists in
// playground mode lands here, so tests can assert on what was written.
const idb = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => idb.get(k),
  set: async (k: string, v: unknown) => {
    idb.set(k, v);
  },
  del: async (k: string) => {
    idb.delete(k);
  },
}));

// Drift recovery goes through fetchRepertoire (HTTP). Stub it so a test
// can assert it was triggered without a network.
vi.mock('../services/repertoire', () => ({
  fetchRepertoire: vi.fn(async () => ({ ok: false })),
}));

import { fetchRepertoire } from '../services/repertoire';
import { EXAMPLE_CHAPTER_NAME, MAX_COMMENT_CHARS, useTrainerStore } from './state';
import { PLAYGROUND_KEY, useAuthStore } from './auth';
import { cardDueIn, chapter, ITALIAN, node, mainLine } from '../test/fixtures';
import { nodeAtPath, nodeAtPathOrNull } from '../util/tree';

const DAY = 24 * 60 * 60 * 1000;
const store = () => useTrainerStore.getState();
const chapterIds = () => idb.get('trainer:chapters') as string[] | undefined;
const savedChapter = (uuid: string) =>
  idb.get(`trainer:chapter:${uuid}`) as ReturnType<typeof chapter> | undefined;

beforeEach(() => {
  idb.clear();
  useAuthStore.setState({ user: null });
  useTrainerStore.setState(useTrainerStore.getInitialState(), true);
  vi.useFakeTimers({ now: new Date('2026-03-01T09:00:00Z') });
});
afterEach(() => vi.useRealTimers());

// Add a chapter, select it, and put the cursor on the root so edit /
// learn / recall actions have somewhere to start.
async function loadChapter(pgn = ITALIAN, trainAs: 'white' | 'black' = 'white') {
  const c = chapter(pgn, trainAs, 'fixture');
  await store().addNewChapter(c);
  store().setSelectedChapterId(c.uuid);
  store().jump('');
  return c;
}

describe('adding chapters (playground)', () => {
  test('white chapters go first, black chapters last, selection is stable', async () => {
    const w1 = chapter(ITALIAN, 'white', 'w1');
    const b1 = chapter(ITALIAN, 'black', 'b1');
    const w2 = chapter(ITALIAN, 'white', 'w2');
    await store().addNewChapter(w1);
    await store().addNewChapter(b1);
    await store().addNewChapter(w2);
    expect(store().repertoire.map((c) => c.name)).toEqual(['w2', 'w1', 'b1']);
    // first added chapter got selected and stays selected
    expect(store().selectedChapterId).toBe(w1.uuid);
  });

  test('persists each chapter blob and the id list to IDB', async () => {
    const c = await loadChapter();
    expect(chapterIds()).toEqual([c.uuid]);
    expect(savedChapter(c.uuid)?.name).toBe('fixture');
    expect(mainLine(savedChapter(c.uuid)!.root)).toEqual(mainLine(c.root));
  });
});

describe('hydrateRepertoireFromIDB', () => {
  test('seeds the example chapter for a first-time user', async () => {
    await store().hydrateRepertoireFromIDB();
    expect(store().repertoire).toHaveLength(1);
    expect(store().repertoire[0].name).toBe(EXAMPLE_CHAPTER_NAME);
    expect(store().selectedChapterId).toBe(store().repertoire[0].uuid);
    expect(chapterIds()).toHaveLength(1);
  });

  test('loads persisted chapters sorted white-first', async () => {
    const b = chapter(ITALIAN, 'black', 'b');
    const w = chapter(ITALIAN, 'white', 'w');
    idb.set('trainer:chapters', [b.uuid, w.uuid]);
    idb.set(`trainer:chapter:${b.uuid}`, b);
    idb.set(`trainer:chapter:${w.uuid}`, w);

    await store().hydrateRepertoireFromIDB();
    expect(store().repertoire.map((c) => c.name)).toEqual(['w', 'b']);
    expect(store().selectedChapterId).toBe(w.uuid);
  });

  test('is a no-op once a repertoire is loaded', async () => {
    await loadChapter();
    await store().hydrateRepertoireFromIDB();
    expect(store().repertoire).toHaveLength(1);
    expect(store().repertoire[0].name).toBe('fixture');
  });
});

describe('edit mode', () => {
  test('makeMove adds a new node, marks it trainable for our color, and follows it', async () => {
    const c = await loadChapter();
    store().setTrainingMethod('edit');
    const before = { enabled: c.enabledCount, unseen: c.unseenCount };

    await store().makeMove('d4');

    const d4 = store().repertoire[0].root.children.find((n) => n.data.san === 'd4');
    expect(d4).toBeDefined();
    expect(d4!.data.enabled).toBe(true);
    expect(d4!.data.ply).toBe(1);
    expect(d4!.data.fen).toContain('3P4');
    expect(store().selectedPath).toBe(d4!.data.id);
    expect(store().selectedNode).toBe(d4);
    expect(store().repertoire[0].enabledCount).toBe(before.enabled + 1);
    expect(store().repertoire[0].unseenCount).toBe(before.unseen + 1);
    // persisted
    expect(savedChapter(c.uuid)!.root.children.map((n) => n.data.san)).toContain('d4');
  });

  test("the opponent's reply is not trainable and doesn't bump counts", async () => {
    const c = await loadChapter();
    store().setTrainingMethod('edit');
    await store().makeMove('e4');
    const before = store().repertoire[0].enabledCount;
    await store().makeMove('c5');
    const c5 = store().selectedNode!;
    expect(c5.data.san).toBe('c5');
    expect(c5.data.enabled).toBe(false);
    expect(c5.data.ply).toBe(2);
    expect(store().repertoire[0].enabledCount).toBe(before);
    expect(store().selectedPath).toBe(c.root.children[0].data.id + c5.data.id);
  });

  test('replaying an existing move navigates instead of duplicating', async () => {
    await loadChapter();
    store().setTrainingMethod('edit');
    await store().makeMove('e4');
    expect(store().repertoire[0].root.children).toHaveLength(1);
    expect(store().selectedNode?.data.san).toBe('e4');
  });

  test('deleteLine removes the subtree, fixes counts, and jumps to the parent', async () => {
    const c = await loadChapter();
    const e4 = c.root.children[0];
    const nf3Path = e4.data.id + e4.children[0].data.id + e4.children[0].children[0].data.id;
    store().jump(nf3Path);

    await store().deleteLine(nf3Path);

    expect(nodeAtPathOrNull(store().repertoire[0].root, nf3Path)).toBeUndefined();
    expect(store().repertoire[0].enabledCount).toBe(1); // only e4 left
    expect(store().repertoire[0].unseenCount).toBe(1);
    expect(store().selectedPath).toBe(e4.data.id + e4.children[0].data.id);
    expect(mainLine(savedChapter(c.uuid)!.root)).toEqual(['e4', 'e5']);
  });

  test('deleteLine and setCommentAt resync when the path is not in our tree', async () => {
    const c = await loadChapter();
    await store().deleteLine(c.root.children[0].data.id + 'zz');
    expect(fetchRepertoire).toHaveBeenCalledTimes(1);
    expect(store().repertoire[0].root.children).toHaveLength(1); // nothing deleted
    await store().setCommentAt('drifted', 'zz');
    expect(fetchRepertoire).toHaveBeenCalledTimes(2);
    expect(store().repertoire[0].root.data.comment).toBe('');
  });

  test('setCommentAt writes, caps length, and persists', async () => {
    const c = await loadChapter();
    const path = c.root.children[0].data.id;
    await store().setCommentAt('x'.repeat(MAX_COMMENT_CHARS + 50), path);
    const comment = nodeAtPath(store().repertoire[0].root, path).data.comment;
    expect(comment).toHaveLength(MAX_COMMENT_CHARS);
    expect(nodeAtPath(savedChapter(c.uuid)!.root, path).data.comment).toHaveLength(MAX_COMMENT_CHARS);
  });
});

describe('learn', () => {
  test('setNextTrainablePosition points at the first unseen move', async () => {
    const c = await loadChapter();
    store().setTrainingMethod('learn');
    store().setNextTrainablePosition();
    expect(store().userTip).toBe('learn');
    expect(store().selectedPath).toBe('');
    expect(store().trainableContext?.targetMove.data.san).toBe('e4');
    expect(store().trainableContext?.startingPath).toBe('');
    void c;
  });

  test('learn() creates a playground card and advances to the next move', async () => {
    const c = await loadChapter();
    store().setTrainingMethod('learn');
    store().setNextTrainablePosition();
    store().learn();

    const e4 = store().repertoire[0].root.children[0];
    expect(e4.data.training[PLAYGROUND_KEY]).toBeDefined();
    expect(e4.data.training[PLAYGROUND_KEY].reps).toBe(0);
    expect(store().repertoire[0].unseenCount).toBe(2);
    expect(savedChapter(c.uuid)!.root.children[0].data.training[PLAYGROUND_KEY]).toBeDefined();

    store().setNextTrainablePosition();
    expect(store().trainableContext?.targetMove.data.san).toBe('Nf3');
    expect(store().selectedPath).toBe(e4.data.id + e4.children[0].data.id);
    expect(store().selectedNode?.data.san).toBe('e5');
  });

  test('once everything is learned the tip is empty', async () => {
    await loadChapter();
    store().setTrainingMethod('learn');
    for (let i = 0; i < 3; i++) {
      store().setNextTrainablePosition();
      store().learn();
    }
    store().setNextTrainablePosition();
    expect(store().userTip).toBe('empty');
    expect(store().trainableContext).toBeNull();
    expect(store().repertoire[0].unseenCount).toBe(0);
  });

  test('learn() resyncs instead of writing when the target vanished', async () => {
    await loadChapter();
    store().setTrainingMethod('learn');
    store().setNextTrainablePosition();
    // yank the target out from under it (a peer deleted it)
    store().repertoire[0].root.children = [];
    store().learn();
    expect(fetchRepertoire).toHaveBeenCalled();
  });
});

describe('recall', () => {
  async function learnE4() {
    const c = await loadChapter();
    store().setTrainingMethod('learn');
    store().setNextTrainablePosition();
    store().learn();
    return c;
  }

  test('a freshly learned card is due immediately', async () => {
    await learnE4();
    store().setTrainingMethod('recall');
    store().setNextTrainablePosition();
    expect(store().trainableContext?.targetMove.data.san).toBe('e4');
  });

  test('guess classifies success / alternate / failure', async () => {
    await learnE4();
    // give the root a second trainable child so 'alternate' is reachable
    store().setTrainingMethod('edit');
    store().jump('');
    await store().makeMove('d4');
    store().jump('');

    store().setTrainingMethod('recall');
    store().setNextTrainablePosition();
    expect(store().trainableContext?.targetMove.data.san).toBe('e4');
    expect(store().guess('e4')).toBe('success');
    expect(store().guess('d4')).toBe('alternate');
    expect(store().guess('c4')).toBe('failure');
    expect(store().lastGuess).toBe('c4');
  });

  test('train(true) pushes the card into the future; the move is then not due', async () => {
    const c = await learnE4();
    store().setTrainingMethod('recall');
    store().setNextTrainablePosition();

    const secondsTilDue = store().train(true);
    expect(secondsTilDue).toBeGreaterThan(0);
    const card = store().repertoire[0].root.children[0].data.training[PLAYGROUND_KEY];
    expect(card.reps).toBe(1);
    expect(new Date(card.due).getTime()).toBeGreaterThan(Date.now());
    expect(savedChapter(c.uuid)!.root.children[0].data.training[PLAYGROUND_KEY].reps).toBe(1);

    store().setNextTrainablePosition();
    expect(store().userTip).toBe('empty');

    vi.advanceTimersByTime(secondsTilDue! * 1000 + 1000);
    store().setNextTrainablePosition();
    expect(store().trainableContext?.targetMove.data.san).toBe('e4');
  });

  test('train(false) records a lapse', async () => {
    await learnE4();
    store().setTrainingMethod('recall');
    store().setNextTrainablePosition();
    store().train(true);
    const card = store().repertoire[0].root.children[0].data.training[PLAYGROUND_KEY];
    vi.setSystemTime(new Date(card.due).getTime() + 1000);
    store().setNextTrainablePosition();
    store().train(false);
    expect(store().repertoire[0].root.children[0].data.training[PLAYGROUND_KEY].lapses).toBe(1);
  });

  test('updateDueCounts tracks due-now count and per-card due times', async () => {
    await learnE4();
    store().setTrainingMethod('recall');
    store().setNextTrainablePosition();
    store().train(true);
    store().updateDueCounts();
    expect(store().dueTimes).toHaveLength(1);
    expect(store().dueTimes[0]).toBeGreaterThan(0);
    expect(store().repertoire[0].lastDueCount).toBe(0);

    vi.advanceTimersByTime(60 * DAY);
    store().updateDueCounts();
    expect(store().repertoire[0].lastDueCount).toBe(1);
  });
});

describe('chapter management', () => {
  test('renameChapter updates state and IDB', async () => {
    const c = await loadChapter();
    await store().renameChapter(c.uuid, 'renamed');
    expect(store().repertoire[0].name).toBe('renamed');
    expect(savedChapter(c.uuid)?.name).toBe('renamed');
  });

  test('deleting the active chapter selects a neighbour and clears context', async () => {
    const a = chapter(ITALIAN, 'white', 'a');
    const b = chapter(ITALIAN, 'white', 'b');
    await store().addNewChapter(a);
    await store().addNewChapter(b); // repertoire: [b, a]; selected: a
    store().setTrainingMethod('learn');
    store().setNextTrainablePosition();

    await store().deleteChapterAt(a.uuid);
    expect(store().repertoire.map((c) => c.name)).toEqual(['b']);
    expect(store().selectedChapterId).toBe(b.uuid);
    expect(store().selectedPath).toBe('');
    expect(store().trainableContext).toBeNull();
    expect(chapterIds()).toEqual([b.uuid]);
    expect(savedChapter(a.uuid)).toBeUndefined();
  });

  test('deleting a background chapter leaves the selection alone', async () => {
    const a = chapter(ITALIAN, 'white', 'a');
    const b = chapter(ITALIAN, 'white', 'b');
    await store().addNewChapter(a);
    await store().addNewChapter(b);
    await store().deleteChapterAt(b.uuid);
    expect(store().selectedChapterId).toBe(a.uuid);
  });

  test('deleting the last chapter empties the selection', async () => {
    const c = await loadChapter();
    await store().deleteChapterAt(c.uuid);
    expect(store().repertoire).toEqual([]);
    expect(store().selectedChapterId).toBeNull();
    expect(chapterIds()).toEqual([]);
  });
});

describe('remote events (what the websocket handlers call)', () => {
  test('addMove attaches at path and bumps counts', async () => {
    const c = await loadChapter();
    const e4 = c.root.children[0];
    await store().addMove(c.uuid, e4.data.id, node('zz', { san: 'c5', enabled: false, ply: 2 }));
    expect(e4.children.map((n) => n.data.san)).toEqual(['e5', 'c5']);
    expect(store().repertoire[0].enabledCount).toBe(3);
    // enabled=false doesn't count as trainable, but unseen is keyed off cards
    expect(store().repertoire[0].unseenCount).toBe(4);
  });

  test('addMove at an unknown path triggers a resync', async () => {
    const c = await loadChapter();
    await store().addMove(c.uuid, 'nope', node('zz'));
    expect(fetchRepertoire).toHaveBeenCalled();
  });

  test('deleteNodeRemote prunes and re-targets if we were inside the subtree', async () => {
    const c = await loadChapter();
    const e4 = c.root.children[0];
    const deep = e4.data.id + e4.children[0].data.id;
    store().setTrainingMethod('learn');
    store().jump(deep);
    store().deleteNodeRemote(c.uuid, e4.data.id);
    expect(store().repertoire[0].root.children).toHaveLength(0);
    expect(store().selectedPath).toBe('');
    expect(store().repertoire[0].enabledCount).toBe(0);
    expect(store().userTip).toBe('empty');
  });

  test('updateTrainingRemote installs a card under the given username', async () => {
    const c = await loadChapter();
    const path = c.root.children[0].data.id;
    const card = cardDueIn(DAY, 'bob').bob;
    store().updateTrainingRemote(c.uuid, path, 'bob', card);
    expect(nodeAtPath(store().repertoire[0].root, path).data.training.bob).toBe(card);
    // our own view is unaffected
    expect(nodeAtPath(store().repertoire[0].root, path).data.training[PLAYGROUND_KEY]).toBeUndefined();
  });

  test('setCommentRemote updates the node and is a no-op on unknown paths', async () => {
    const c = await loadChapter();
    const path = c.root.children[0].data.id;
    store().setCommentRemote(c.uuid, path, 'from a peer');
    expect(nodeAtPath(store().repertoire[0].root, path).data.comment).toBe('from a peer');
    store().setCommentRemote(c.uuid, 'nope', 'ignored');
    store().setCommentRemote('no-such-chapter', path, 'ignored');
    expect(nodeAtPath(store().repertoire[0].root, path).data.comment).toBe('from a peer');
    // an unknown path must not fall back onto an ancestor (the root here)
    expect(store().repertoire[0].root.data.comment).toBe('');
  });

  test('deleteNodeRemote with an unknown path deletes nothing', async () => {
    const c = await loadChapter();
    store().deleteNodeRemote(c.uuid, c.root.children[0].data.id + 'zz');
    expect(mainLine(store().repertoire[0].root)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    expect(store().repertoire[0].enabledCount).toBe(3);
  });

  test('updateTrainingRemote with an unknown path writes nothing', async () => {
    const c = await loadChapter();
    store().updateTrainingRemote(c.uuid, 'zz', 'bob', cardDueIn(DAY, 'bob').bob);
    expect(store().repertoire[0].root.data.training).toEqual({});
  });

  test('deleteChapterRemote mirrors deleteChapterAt without touching IDB', async () => {
    const c = await loadChapter();
    store().deleteChapterRemote(c.uuid);
    expect(store().repertoire).toEqual([]);
    expect(store().selectedChapterId).toBeNull();
    expect(chapterIds()).toEqual([c.uuid]); // server-owned; not our job here
  });
});

describe('resyncAndRestore', () => {
  // The server broadcasts a reload after every chapter add / delete, so
  // this runs constantly for signed-in users. Whatever it lands on must
  // be a real node: with selectedNode null the board still accepts moves
  // but makeMove has nothing to attach them to.
  test('lands on the root when the old path is gone', async () => {
    const c = await loadChapter();
    store().jump(c.root.children[0].data.id); // on e4
    vi.mocked(fetchRepertoire).mockImplementationOnce(async () => {
      // the server's copy no longer has e4
      const fresh = chapter('1. d4 d5 *', 'white', 'fixture');
      fresh.uuid = c.uuid;
      await store().setRepertoire([fresh]);
      return { ok: true, status: 200 };
    });

    await store().resyncAndRestore();

    expect(store().selectedPath).toBe('');
    expect(store().selectedNode).toBe(store().repertoire[0].root);
  });

  test('restores the old path when it still exists', async () => {
    const c = await loadChapter();
    const e4 = c.root.children[0];
    store().jump(e4.data.id);
    vi.mocked(fetchRepertoire).mockImplementationOnce(async () => {
      const fresh = chapter(ITALIAN, 'white', 'fixture');
      fresh.uuid = c.uuid;
      await store().setRepertoire([fresh]);
      return { ok: true, status: 200 };
    });

    await store().resyncAndRestore();

    expect(store().selectedPath).toBe(e4.data.id);
    expect(store().selectedNode?.data.san).toBe('e4');
    expect(store().selectedNode).toBe(store().repertoire[0].root.children[0]);
  });

  test('with no chapter at all, nothing is selected', async () => {
    await store().resyncAndRestore();
    expect(store().selectedNode).toBeNull();
    expect(store().selectedPath).toBe('');
  });
});

describe('clearChapterContext (clicking a chapter row)', () => {
  test('lands on the root of the selected chapter, even if it was already selected', async () => {
    const c = await loadChapter();
    store().setTrainingMethod('edit');
    store().jump(c.root.children[0].data.id);

    store().clearChapterContext();

    expect(store().trainingMethod).toBeNull();
    expect(store().selectedPath).toBe('');
    expect(store().selectedNode).toBe(c.root);
    // and a move made straight after attaches to that root
    store().setTrainingMethod('edit');
    await store().makeMove('d4');
    expect(c.root.children.map((n) => n.data.san)).toEqual(['e4', 'd4']);
  });

  test('with nothing selected there is no node', () => {
    store().clearChapterContext();
    expect(store().selectedNode).toBeNull();
  });
});
