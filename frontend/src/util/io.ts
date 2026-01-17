import {
  Game,
  Node,
  parsePgn,
  PgnNodeData,
} from 'chessops/pgn';
import { Chapter, Color, TrainableNode, TrainingConfig } from '../types/training';
import { annotateMoves } from './training';
import { INITIAL_BOARD_FEN } from 'chessops/fen';


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
export const chapterFromPgn = (rawPgn: string, asColor: Color, name: string, config: TrainingConfig) => {
  const { root, nodeCount } = rootFromPgn(rawPgn, asColor);

  const chapter: Chapter = {
    id: crypto.randomUUID(),
    root: root,
    name: name,
    bucketEntries: config.buckets.map(() => 0),
    nodeCount: nodeCount,
    lastDueCount: 0,
    trainAs: asColor,
  };
  return chapter;
};

export const rootFromPgn = (
  rawPgn: string,
  asColor: Color,
): {
  root: TrainableNode;
  nodeCount: Number;
} => {
  // don't allow multiple games in one PGN
  const parsedRoot: Node<PgnNodeData> = parsePgn(rawPgn).at(0).moves;
  const { moves, nodeCount: nodeCount } = annotateMoves(parsedRoot, false, asColor);
  // put initial position first
  //TODO do something about mainline, etc..
  const root: TrainableNode = {
    data: {
      comment: '',
      fen: INITIAL_BOARD_FEN,
      id: '',
      ply: 0,
      san: '',
      //TODO shortcut for disabled
      training: {
        disabled: true,
        dueAt: -1,
        group: -1,
        seen: false,
      },
    },
    children: moves.children,
  };
  return { root, nodeCount };
};

/*
  Import annotated entry 
*/

export const importAnnotatedPgn = (annotatedPgn: string) => {
  // TODO why is PGN undefined?
  const chapters: Chapter[] = [];
  const parts: Game<PgnNodeData>[] = parsePgn(annotatedPgn);
  parts.forEach((part) => {
    console.log("part", part);

    const { moves, nodeCount: nodeCount } = annotateMoves(part.moves, true);
    // put initial position first
    //TODO do something about mainline, etc..
    const root: TrainableNode = {
      data: {
        comment: '',
        fen: INITIAL_BOARD_FEN,
        id: '',
        ply: 0,
        san: '',
        //TODO shortcut for disabled
        training: {
          disabled: true,
          dueAt: -1,
          group: -1,
          seen: false,
        },
      },
      children: moves.children,
    };

    const bucketEntries = part.headers
      .get('bucketEntries')!
      .split(',')
      .map((x) => parseInt(x));

    const chapterName = part.headers.get('ChessrepeatChapterName');
    const asColor = part.headers.get('trainAs') as Color;

    const chapter: Chapter = {
      id: crypto.randomUUID(),
      root: root,
      name: chapterName,
      bucketEntries: bucketEntries,
      nodeCount: nodeCount,
      lastDueCount: 0,
      trainAs: asColor,
    };

    chapters.push(chapter);
  });

  return chapters;
};