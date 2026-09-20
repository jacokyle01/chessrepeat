import { describe, expect, test, vi } from 'vitest';
import { INITIAL_BOARD_FEN } from 'chessops/fen';
import { chapterFromImport, chapterFromPgn, repertoireAsJson } from './io';
import { pgnFromChapter } from './training';
import { forEachNode, nodeAtPath } from './tree';
import { COMMENTED, ITALIAN, SICILIAN_TWO_LINES, chapter, mainLine } from '../test/fixtures';

describe('chapterFromPgn', () => {
  test('builds the main line with real ids, plies and fens', () => {
    const c = chapter(ITALIAN, 'white', 'Italian');
    expect(c.name).toBe('Italian');
    expect(c.trainAs).toBe('white');
    expect(c.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(mainLine(c.root)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);

    const first = c.root.children[0];
    expect(first.data.ply).toBe(1);
    expect(first.data.id).toHaveLength(2);
    expect(first.data.fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(first.data.training).toEqual({});

    expect(c.root.data.fen).toBe(INITIAL_BOARD_FEN);
    expect(c.root.data.ply).toBe(0);
  });

  test('training as white enables only white moves', () => {
    const c = chapter(ITALIAN, 'white');
    const enabled: boolean[] = [];
    let cur = c.root;
    while (cur.children.length) {
      cur = cur.children[0];
      enabled.push(cur.data.enabled);
    }
    expect(enabled).toEqual([true, false, true, false, true, false]);
    expect(c.enabledCount).toBe(3);
    expect(c.unseenCount).toBe(3);
    expect(c.lastDueCount).toBe(0);
  });

  test('training as black enables only black moves', () => {
    const c = chapter(ITALIAN, 'black');
    expect(c.root.children[0].data.enabled).toBe(false);
    expect(c.root.children[0].children[0].data.enabled).toBe(true);
    expect(c.enabledCount).toBe(3);
  });

  test('keeps variations', () => {
    const c = chapter(SICILIAN_TWO_LINES);
    // 1. e4 c5 2. Nf3 (2. Nc3 Nc6) 2... d6 3. d4 cxd4
    const afterC5 = c.root.children[0].children[0];
    expect(afterC5.children.map((n) => n.data.san)).toEqual(['Nf3', 'Nc3']);
    expect(mainLine(afterC5.children[1])).toEqual(['Nc6']);
    expect(mainLine(afterC5.children[0])).toEqual(['d6', 'd4', 'cxd4']);
    // white moves: e4, Nf3, Nc3, d4
    expect(c.enabledCount).toBe(4);
  });

  test('carries comments onto nodes', () => {
    const c = chapter(COMMENTED);
    expect(c.root.children[0].data.comment).toBe('king pawn');
    expect(c.root.children[0].children[0].data.comment).toBe('symmetric');
    expect(c.root.children[0].children[0].children[0].data.comment).toBe('');
  });

  test('returns null and alerts on an illegal move', () => {
    // chessops' parser is lenient about unparseable tokens (it just drops
    // them), so the failure has to come from a well-formed but illegal SAN.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(chapterFromPgn('1. e4 e5 2. Nf6 *', 'white', 'bad')).toBeNull();
    expect(alert).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });

  test('returns null on an empty PGN', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(chapterFromPgn('', 'white', 'empty')).toBeNull();
  });

  test('imports only the first game of a multi-game PGN', () => {
    const c = chapter('1. e4 *\n\n1. d4 *');
    expect(c.root.children.map((n) => n.data.san)).toEqual(['e4']);
  });
});

describe('pgn round trip', () => {
  test('export then import preserves structure and comments', () => {
    const original = chapter(SICILIAN_TWO_LINES, 'white', 'Sicilian');
    nodeAtPath(original.root, original.root.children[0].data.id).data.comment = 'open game';

    const pgn = pgnFromChapter(original);
    expect(pgn).toContain('[ChessrepeatChapterName "Sicilian"]');
    expect(pgn).toContain('{ open game }');

    const again = chapter(pgn, 'white', 'Sicilian');
    const ids = (root: typeof original.root) => {
      const out: string[] = [];
      forEachNode(root, (n) => out.push(n.data.id + ':' + n.data.san + ':' + n.data.comment));
      return out;
    };
    expect(ids(again.root)).toEqual(ids(original.root));
    expect(again.enabledCount).toBe(original.enabledCount);
  });
});

describe('json export / import', () => {
  test('repertoireAsJson strips uuids', () => {
    const a = chapter(ITALIAN, 'white', 'a');
    const b = chapter(ITALIAN, 'black', 'b');
    const parsed = JSON.parse(repertoireAsJson([a, b]));
    expect(parsed.chapters).toHaveLength(2);
    for (const c of parsed.chapters) expect(c.uuid).toBeUndefined();
    expect(parsed.chapters[0].name).toBe('a');
    expect(parsed.chapters[0].root.children[0].data.san).toBe('e4');
  });

  test('chapterFromImport mints a fresh uuid even if one is present', () => {
    const a = chapter(ITALIAN);
    const imported = chapterFromImport({ ...a, uuid: 'stale' });
    expect(imported.uuid).not.toBe('stale');
    expect(imported.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(imported.name).toBe(a.name);
  });
});
