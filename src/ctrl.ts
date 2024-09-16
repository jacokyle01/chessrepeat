import { Api } from 'chessground/api';
import { Redraw, RepertoireEntry } from './types/types';
import { initial } from 'chessground/fen';
import { Key } from 'chessground/types';
import { Config as CgConfig } from 'chessground/config';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap } from './util';
import { configure, Config as SrsConfig } from '../src/spaced-repetition/config';
import {
  Color,
  DequeEntry,
  Method,
  TrainingPath,
  Subrepertoire,
  TrainingData,
} from './spaced-repetition/types';
import { ChildNode, Game, parsePgn, PgnNodeData, walk } from 'chessops/pgn';
import { countDueContext, generateSubrepertoire } from './spaced-repetition/util';
import { defaults } from './spaced-repetition/config';
import { init } from './debug/init';


export default class PrepCtrl {
  repertoire: RepertoireEntry[];
  srsConfig: SrsConfig;
  repertoireIndex: number;
  currentTime: number;
  method: Method;
  trainingPath: TrainingPath;
  chessground: Api | undefined; // stores FEN
  addingNewSubrep;
  showingTrainingSettings;
  lastFeedback: 'init' | 'learn' | 'recall' | 'fail' | 'alternate' | 'empty';
  pathIndex: number = -1;

  constructor(readonly redraw: Redraw) {
    //we are initially learning
    document.addEventListener('DOMContentLoaded', (_) => {
      init(this);
    });
    this.currentTime = Math.round(Date.now() / 1000);
    this.repertoire = [];
    this.trainingPath = [];
    this.repertoireIndex = 0;
    this.method = 'learn';
    this.lastFeedback = 'init';
    this.srsConfig = defaults();

    this.addingNewSubrep = false;
    this.showingTrainingSettings = true;

    this.setSrsConfig({
      getNext: {
        by: 'depth',
        max: 10,
      },
      buckets: [2, 4, 8, 16, 32, 65, 128],
    });
  }

  setSrsConfig = (config: SrsConfig): void => {
    configure(this.srsConfig, config);
  };

  addToRepertoire = (pgn: string, color: Color, name: string) => {
    const subreps: Game<PgnNodeData>[] = parsePgn(pgn);
    for (const subrep of subreps) {
      //augment subrepertoire with a) color to train as, and b) training data
      const annotatedSubrep: Subrepertoire<TrainingData> = {
        ...subrep,
        headers: {
          ...subrep.headers,
        },
        ...generateSubrepertoire(subrep.moves, color, this.srsConfig!.buckets!),
      };
      this.repertoire.push({
        subrep: annotatedSubrep,
        name,
        lastDueCount: 0,
      });
    }
    this.redraw();
  };

  // keep an internal representation of time to be more flexible
  syncTime = () => {
    this.currentTime = Math.floor(Date.now() / 1000);
  };

  // TODO return trainingPath, then we set it

  getNext = () => {
    if (this.repertoireIndex == -1) return false; // no subrepertoire selected
    //initialization
    let deque: DequeEntry[] = [];
    let subrep = this.repertoire[this.repertoireIndex].subrep;
    //initialize deque
    for (const child of subrep.moves.children) {
      deque.push({
        path: [child],
        layer: 0,
      });
    }
    while (deque.length != 0) {
      //initialize dedequed path
      const entry = this.srsConfig!.getNext!.by == 'breadth' ? deque.shift()! : deque.pop()!;
      const pos = entry.path.at(-1)!;

      //test if match
      if (!pos.data.training.disabled) {
        switch (this.method) {
          case 'recall': //recall if due
            if (pos.data.training.dueAt <= this.currentTime) {
              this.trainingPath = entry.path;
              return true;
            }
            break;
          case 'learn': //learn if unseen
            if (!pos.data.training.seen) {
              this.trainingPath = entry.path;
              return true;
            }
            break;
        }
      }

      //push child nodes
      //TODO guarantee non-full
      if (entry.layer < this.srsConfig!.getNext!.max!) {
        for (const child of pos.children) {
          const DequeEntry: DequeEntry = {
            path: [...entry.path, child],
            layer: ++entry.layer,
          };
          deque.push(DequeEntry);
        }
      }
    }
    return false;
  };

  makeGuess = (san: string) => {
    const index = this.repertoireIndex;
    if (index == -1 || !this.trainingPath || this.method == 'learn') return;
    let candidates: ChildNode<TrainingData>[] = [];
    if (this.trainingPath.length == 1) {
      this.repertoire[index].subrep.moves.children.forEach((child) => candidates.push(child));
    } else {
      this.trainingPath.at(-2)?.children.forEach((child) => candidates.push(child));
    }

    let moves: string[] = [];
    moves = candidates.map((candidate) => candidate.data.san);

    return moves.includes(san)
      ? this.trainingPath.at(-1)?.data.san === san
        ? 'success'
        : 'alternate'
      : 'failure';
  };

  succeed = () => {
    const node = this.trainingPath?.at(-1);
    const subrep = this.repertoire[this.repertoireIndex].subrep;
    if (!node) return;
    switch (this.method) {
      case 'recall':
        let groupIndex = node.data.training.group;
        subrep.meta.bucketEntries[groupIndex]--;
        switch (this.srsConfig!.promotion) {
          case 'most':
            groupIndex = this.srsConfig!.buckets!.length - 1;
            break;
          case 'next':
            groupIndex = Math.min(groupIndex + 1, this.srsConfig!.buckets!.length - 1);
            break;
        }
        subrep.meta.bucketEntries[groupIndex]++;
        const interval = this.srsConfig!.buckets![groupIndex];

        node.data.training = {
          ...node.data.training,
          group: groupIndex,
          dueAt: this.currentTime + interval,
        };
        break;
      case 'learn':
        node.data.training = {
          ...node.data.training,
          seen: true,
          dueAt: this.currentTime + this.srsConfig!.buckets![0],
          group: 0,
        };
        subrep.meta.bucketEntries[0]++; //globally, mark node as seen
        break;
    }
  };

  fail = () => {
    let node = this.trainingPath?.at(-1);
    const subrep = this.repertoire[this.repertoireIndex].subrep;
    if (!node) return;
    let groupIndex = node.data.training.group;
    subrep.meta.bucketEntries[groupIndex]--;
    if (this.method === 'recall') {
      switch (this.srsConfig!.demotion) {
        case 'most':
          groupIndex = 0;
          break;
        case 'next':
          groupIndex = Math.max(groupIndex - 1, 0);
          break;
      }
      subrep.meta.bucketEntries[groupIndex]++;
      const interval = this.srsConfig!.buckets![groupIndex];

      node.data.training = {
        ...node.data.training,
        group: groupIndex,
        dueAt: this.currentTime + interval,
      };
    }
  };

  countDue = () => {
    const current = this.repertoire[this.repertoireIndex].subrep;
    const root = current.moves;
    const ctx = countDueContext(0);
    walk(root, ctx, (ctx, data) => {
      ctx.count += !data.training.disabled && data.training.dueAt < this.currentTime ? 1 : 0;
    });
    return ctx.count;
  };

  // resets subrepertoire-specific context,
  // e.x. for selecting a different subrepertoire for training

  clearSubrepertoireContext = () => {
    this.lastFeedback = 'init';
    //TODO do automatic recall/learn
    // reset board
    this.chessground?.set({
      fen: initial,
      drawable: {
        autoShapes: [],
      },
    });
  };

  subrep = () => {
    return this.repertoire[this.repertoireIndex]?.subrep;
  };

  selectSubrepertoire = (which: number) => {
    if (which == this.repertoireIndex) return;
    this.repertoireIndex = which;
    this.clearSubrepertoireContext();
    this.redraw();
    this.chessground?.setAutoShapes([]);
  };

  toggleAddingNewSubrep = () => {
    this.addingNewSubrep = this.addingNewSubrep ? false : true;
    this.redraw();
  };

  jump = (index: number) => {
    this.pathIndex = index;
    const opts = this.makeCgOpts();
    this.chessground!.set(opts);
    this.redraw();
  };

  atLast = () => {
    return this.pathIndex === this.trainingPath.length - 2;
  };

  makeCgOpts = (): CgConfig => {
    console.log('Make CG OPTS');
    console.log('trainingPath', this.trainingPath);

    const fen = this.trainingPath.at(-2)?.data.fen || initial;

    // get last move, if it exists
    let lastMoves: Key[] = [];
    if (this.atLast() && this.trainingPath && this.trainingPath!.length > 1) {
      const fen2 = this.trainingPath?.at(-3)?.data.fen || initial;
      const oppMoveSan = this.trainingPath?.at(-2)?.data.san;
      const uci2 = calcTarget(fen2, oppMoveSan!);
      lastMoves = [uci2[0], uci2[1]];
    }

    const targetSan = this.trainingPath?.at(-1)?.data.san;
    const uci = calcTarget(fen, targetSan!);

    const config: CgConfig = {
      orientation: this.subrep().meta.trainAs,
      fen: this.trainingPath[this.pathIndex]?.data.fen || initial,
      lastMove: lastMoves,
      turnColor: this.subrep().meta.trainAs,

      movable: {
        color: this.subrep().meta.trainAs,
        dests: this.atLast()
          ? this.method === 'learn'
            ? toDestMap(uci[0], uci[1])
            : fenToDests(fen)
          : new Map(),
        events: {
          after: (from: Key, to: Key) => {
            if (this.atLast()) {
              switch (this.method) {
                case 'learn':
                  this.succeed();
                  this.handleLearn();
                  break;
                case 'recall':
                  const san = chessgroundToSan(fen, from, to);
                  //TODO be more permissive depending on config
                  switch (this.makeGuess(san)) {
                    case 'success':
                      this.succeed();
                      this.handleRecall();
                      break;
                    case 'alternate':
                      this.succeed();
                      this.handleRecall();
                      break;
                    case 'failure':
                      this.handleFail(san);
                      break;
                  }
                  break;
              }
            }
          },
        },
      },
      drawable: {
        autoShapes:
          this.method === 'learn' && this.atLast() ? [{ orig: uci[0], dest: uci[1], brush: 'green' }] : [],
      },
    };
    console.log('config', config);
    return config;
  };

  handleLearn = () => {
    this.syncTime();
    this.repertoire[this.repertoireIndex].lastDueCount = this.countDue();
    this.lastFeedback = 'learn';
    this.method = 'learn';

    // mututes path
    if (!this.getNext()) {
      this.lastFeedback = 'empty';
      this.redraw();
    } else {
      // update path and pathIndex
      this.pathIndex = this.trainingPath.length - 2;
      const opts = this.makeCgOpts();
      this.chessground!.set(opts);
      this.redraw();
      // update scroll height
      const movesElement = document.getElementById('moves');
      movesElement!.scrollTop = movesElement!.scrollHeight;
    }
  };

  handleFail = (attempt: string) => {
    console.log(attempt);
    this.lastFeedback = 'fail';

    // opts should look at lastFeedback
    const opts = this.makeCgOpts();
    console.log(opts);
    this.chessground!.set(opts);
    console.log(this.chessground!.state);

    this.redraw();
  };

  //TODO refactor common logic from learn, recall, into utility method
  handleRecall = () => {
    this.syncTime();
    this.lastFeedback = 'recall';
    this.repertoire[this.repertoireIndex].lastDueCount = this.countDue();
    this.chessground?.setAutoShapes([]); // TODO in separate method?
    this.method = 'recall';

    if (!this.getNext()) {
      this.lastFeedback = 'empty';
      this.redraw();
    } else {
      this.pathIndex = this.trainingPath.length - 2;
      const opts = this.makeCgOpts();
      this.chessground!.set(opts);

      this.redraw();
      // update scroll height
      const movesElement = document.getElementById('moves');
      movesElement!.scrollTop = movesElement!.scrollHeight;
    }
  };

  toggleTrainingSettings = () => {
    this.showingTrainingSettings = !this.showingTrainingSettings;
    this.redraw();
  };
}
