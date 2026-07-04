import { Game, Node, parsePgn, PgnNodeData, transform } from 'chessops/pgn';
import { Chapter, Color, TrainableNode, TrainingConfig, TrainingData } from '../types/training';
import { pgnFromChapter, trainingContext } from './training';
import { INITIAL_BOARD_FEN, makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';

export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/*
  Functions for importing and exporting repertoire chapters
*/

/*
    Import PGN into repertoire 
    -> PGN can consist of one or more chapters 
    -> PGN can be "annotated", which means it has training metadata attached that must be parsed
  */
// Returns null when the PGN can't be parsed (malformed syntax, no game,
// or an illegal/unparseable move). The user is alerted; callers must
// handle the null rather than assuming a chapter came back.
export const chapterFromPgn = (rawPgn: string, asColor: Color, name: string): Chapter | null => {
  const context = trainingContext(asColor || 'white');
  let enabledCount = 0;
  let moves;
  try {
    // parsePgn returns one game per `[Event]`; we only import the first.
    const game = parsePgn(rawPgn)[0];
    if (!game) {
      throw new Error('no game found in PGN');
    }
    moves = transform(game.moves, context, (context, data) => {
      const move = parseSan(context.pos, data.san);
      // parseSan returns undefined for a move that's illegal in the
      // current position (or unparseable SAN) — bail on the whole import.
      if (!move) {
        throw new Error(`illegal or unparseable move: ${data.san}`);
      }
      context.pos.play(move);
      context.ply++;
      context.trainable = !context.trainable; // moves by opposite color are not trainable

      // add training types to each node
      if (!context.trainable) enabledCount++;
      return {
        ...data,
        id: scalachessCharPair(move),
        fen: makeFen(context.pos.toSetup()),
        comment: data.comments?.join('|') || '', //TODO should handle multi comments ..
        ply: context.ply,
        training: {},
        enabled: !context.trainable,
      };
    });
  } catch (e) {
    console.error('pgn parse error', e);
    alert('Error: Invalid PGN');
    return null;
  }

  return {
    name,
    trainAs: asColor,
    uuid: crypto.randomUUID(),
    root: {
      data: {
        comment: '',
        fen: INITIAL_BOARD_FEN,
        id: '',
        ply: 0,
        san: '',
        enabled: false,
        training: {},
      },
      children: moves.children,
    },
    enabledCount,
    unseenCount: enabledCount, //TODO have the option to mark all nodes as already seen
    lastDueCount: 0, //TODO
  };
};

// A chapter's uuid identifies it within *one* device/account's repertoire,
// so it's never exported. On import we mint a fresh uuid (see
// chapterFromImport) — that way an imported backup can't collide with or
// overwrite an existing chapter. Works the same whether the caller passes a
// single chapter or the whole repertoire.
export function repertoireAsJson(chapters: Chapter[]): string {
  const exported = chapters.map((chapter) => {
    const copy: Partial<Chapter> = { ...chapter };
    delete copy.uuid;
    return copy;
  });
  return JSON.stringify(
    {
      chapters: exported,
    },
    null,
    2, // pretty print
  );
}

// Shape a chapter parsed from an imported JSON backup into a store-ready
// Chapter, always assigning a fresh uuid (any uuid present in the source
// JSON is discarded).
export function chapterFromImport(raw: any): Chapter {
  return {
    ...raw,
    uuid: crypto.randomUUID(),
  } as Chapter;
}

//
export function repertoireAsPgn(chapters: Chapter[]): string {
  let repertoire = chapters.map((chapter) => {
    pgnFromChapter(chapter);
  });
  return repertoire.join('');
}
