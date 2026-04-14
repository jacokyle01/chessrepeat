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
export const chapterFromPgn = (rawPgn: string, asColor: Color, name: string): Chapter => {
  // const root = rootFromPgn(rawPgn, asColor);

  // const chapter: Chapter = {
  //   id: crypto.randomUUID(),
  //   root: root,
  //   name: name,
  //   trainAs: asColor,
  // };
  // return chapter;

  const context = trainingContext(asColor || 'white');

  let moves = parsePgn(rawPgn)[0].moves;
  let enabledCount = 0;
  moves = transform(moves, context, (context, data) => {
    const move = parseSan(context.pos, data.san);
    // assume the move is playable
    context.pos.play(move!);
    context.ply++;
    context.trainable = !context.trainable; // moves by opposite color are not trainable
    // idCount++;/

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

//TODO should be combined with function above
// can return more values
export const annotatePgn = (rawPgn: string, asColor: Color): Node<TrainingData> => {
  const context = trainingContext(asColor || 'white');

  return transform(parsePgn(rawPgn)[0].moves, context, (context, data) => {
    const move = parseSan(context.pos, data.san);
    // assume the move is playable
    context.pos.play(move!);
    context.ply++;
    context.trainable = !context.trainable; // moves by opposite color are not trainable
    // idCount++;/

    // add training types to each node
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
};

// export const rootFromPgn = (
//   rawPgn: string,
//   asColor: Color,
// ): {
//   root: TrainableNode;
// } => {
//   // don't allow multiple games in one PGN
//   const parsedRoot: Node<PgnNodeData> = parsePgn(rawPgn).at(0).moves;
//   const { moves } = annotateMoves(parsedRoot, asColor);
//   // put initial position first
//   //TODO do something about mainline, etc..
//   const root: TrainableNode = {
//     data: {
//       comment: '',
//       fen: INITIAL_BOARD_FEN,
//       id: '',
//       ply: 0,
//       san: '',
//       //TODO shortcut for disabled
//       enabled: false,
//       training: {},
//     },
//     children: moves.children,
//   };
//   return root;
// };

export function repertoireAsJson(chapters: Chapter[]): string {
  return JSON.stringify(
    {
      chapters,
    },
    null,
    2, // pretty print
  );
}

//
export function repertoireAsPgn(chapters: Chapter[]): string {
  let repertoire = chapters.map((chapter) => {
    pgnFromChapter(chapter);
  });
  return repertoire.join('');
}
