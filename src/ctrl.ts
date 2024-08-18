import { Api } from 'chessground/api';
import { NewSubrepertoire, PgnViewContext, Redraw } from './types/types';
import { ChessSrs } from 'chess-srs';
import { initial } from 'chessground/fen';
import { Key } from 'chessground/types';
import { Config as CgConfig } from 'chessground/config';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap } from './util';

export default class PrepCtrl {
  //TODO call these "plans"
  subrepertoireNames: string[] = [];
  numDueCache: number[] = [];

  //libraries
  chessground: Api | undefined; // stores FEN

  chessSrs = ChessSrs({
    buckets: [1, 11, 111],
    getNext: {
      by: 'depth',
    },
  }); //stores training data

  addingNewSubrep = false;

  // lastFeedback: 
  lastFeedback: 'init' | 'learn' | 'recall' | 'fail' | 'alternate' = 'init';


  // necessary context to display PGN, either as tree or chessground
  pgnViewContext: PgnViewContext = {
    splitFen: null,
    index: -1,
  };

  path: string[] = []; // array of FEN strings
  pathIndex: number = -1;

  constructor(readonly redraw: Redraw) {
    //we are initially learning
    document.addEventListener('DOMContentLoaded', (_) => {
      this.chessSrs.setMethod('learn');
      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 {Defending the bishop} 7. Qc1 Bxd2+ {Black trades bishops} 8. Qxd2 {White recaptures with the queen} b5 {Defending the pawn} 9. Qg5 b4 10. Rg1 Rg8 11. Rh1 Rh8 a3 Ra7',
        alias: 'catalan',
        trainAs: 'white',
      });

      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc1 Bxd2+ 8. Qxd2 b5 9. Qg5',
        alias: 'catalan2',
        trainAs: 'white',
      });

      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc1 Bxd2+ 8. Qxd2 b5 9. Qg5',
        alias: 'catalan3',
        trainAs: 'white',
      });
      this.addSubrepertoire({
        pgn: "1.e4 e5 2.Nf3 Nc6 ( 2...d6 { Test } 3.d4 { White immediately challenges Black in the centre. } ) ( 2...Qe7 {  } 3.Bc4 { White puts pressure on f7 and plans to castle quickly, before opening the centre with d2-d4. } 3...d6 4.O-O ) 3.Bb5 a6 ( 3...Nf6 4.d3 Bc5 ( 4...d6 5.O-O Bd7 ( 5...Be7 6.h3 O-O ( 6...a6 7.Bxc6+ bxc6 8.Nc3 ) 7.c4 ) ( 5...g6 6.d4 Bd7 ( 6...exd4 7.e5 dxe5 8.Nxe5 ) 7.d5 ) ( 5...a6 6.Bxc6+ bxc6 7.Re1 Be7 ( 7...c5 8.c3 {[%cal Gd3d4]} ) 8.d4 { Transposes to Averbakh Variation } ) 6.Re1 g6 7.d4 Bg7 8.d5 Ne7 9.Bxd7+ Nxd7 ) ( 4...Bd6 5.O-O ) ( 4...Ne7 5.Bc4 {[%cal Rf3e5][%csl Re5]} c6 6.Nc3 ) 5.Bxc6 dxc6 ( 5...bxc6 6.Nxe5 ) 6.Qe2 ( 6.Nc3 Qe7 7.h3 Bd7 ( 7...h6 8.Be3 ) 8.Qe2 O-O-O ) 6...Nd7 ( 6...Qe7 7.Nbd2 O-O 8.Nc4 ) ( 6...Bg4 7.h3 Bxf3 8.Qxf3 ) ( 6...Bd6 7.Nbd2 ) 7.Nbd2 O-O 8.Nc4 Re8 9.h4 b5 10.Ne3 Nf8 11.a4 ) ( 3...Qf6 4.O-O ) ( 3...f5 4.d3 fxe4 ( 4...Nf6 5.exf5 Bc5 ( 5...d6 6.O-O Bxf5 7.d4 ) 6.O-O O-O 7.Be3 Nd4 8.c3 ) ( 4...d6 5.exf5 Bxf5 6.d4 ) 5.dxe4 Nf6 6.O-O Bc5 ( 6...d6 7.Bc4 {[%cal Gf3g5][%csl Gg5]} Bg4 8.h3 Bh5 9.Nc3 Qd7 10.Nd5 O-O-O 11.Qd3 Kb8 12.b4 ) 7.Qd3 ( 7.Bxc6 bxc6 8.Nxe5 O-O 9.Nc3 d6 ( 9...Ba6 10.Nd3 Bb6 11.Bg5 ) 10.Na4 Qe8 11.Nd3 Bg4 12.Qe1 Bd4 13.c3 Bb6 14.Nxb6 axb6 15.f3 Be6 16.a3 Bc4 17.Qd1 ) 7...d6 ( 7...Nd4 8.Nxd4 Bxd4 9.Bc4 ) ( 7...Qe7 8.Nc3 ) ( 7...O-O 8.Qc4+ ) 8.Qc4 Qe7 ( 8...Bd7 9.Nc3 Qe7 ) 9.Nc3 Bd7 ( 9...a6 10.Bxc6+ bxc6 11.Be3 ) 10.Nd5 Nxd5 11.exd5 { Transposes. } 11...Nd4 12.Bxd7+ Qxd7 13.Nxe5 Qf5 14.Nd3 O-O-O 15.Kh1 ) ( 3...Nd4 4.Nxd4 exd4 5.O-O Bc5 ( 5...c6 6.Bc4 Nf6 ( 6...d5 7.exd5 cxd5 8.Bb5+ Bd7 9.Re1+ Ne7 10.c4 ) 7.d3 d5 8.exd5 Nxd5 9.Re1+ ) 6.Bc4 d6 7.d3 Ne7 8.f4 ) ( 3...Nge7 4.Nc3 ( 4.O-O ) ( 4.d4 exd4 5.Nxd4 Nxd4 ( 5...g6 6.Nxc6 Nxc6 ( 6...bxc6 7.Qd4 { This is the point of Bxc6. In reality, Black would rather capture this way to prepare d5. } ) 7.Nc3 Bg7 8.Be3 ) ( 5...Ng6 6.Be3 { Makes Bc5 less appetizing. } 6...Be7 7.Nc3 O-O 8.h4 ) 6.Qxd4 Nc6 7.Qe3 Be7 8.Nc3 O-O 9.O-O ) 4...g6 ( 4...d6 5.d4 a6 ( 5...Bd7 6.d5 ) ( 5...exd4 6.Nxd4 ) 6.Bc4 ) ( 4...Ng6 5.d4 exd4 6.Nxd4 Bc5 7.Be3 ) ( 4...a6 5.Bc4 Ng6 6.d4 ) 5.d4 exd4 ( 5...Bg7 6.dxe5 ) 6.Nd5 Bg7 ( 6...Nxd5 ) 7.Bg5 h6 8.Bf6 Bxf6 ( 8...Kf8 9.Bxg7+ Kxg7 10.Bxc6 Nxc6 11.Qd3 ) 9.Nxf6+ Kf8 10.Qd2 d5 ( 10...Ng8 11.Nxg8 Kxg8 12.O-O-O ) ( 10...a6 11.Bc4 Ng8 12.Nd5 ) ( 10...d6 11.O-O-O ) 11.Bxc6 Nxc6 12.Nxd5 Bf5 13.Qf4 Bxe4 14.Qxe4 Qd6 15.Nxc7 Qxc7 16.O-O-O Re8 17.Qh4 ) ( 3...g6 4.c3 ( 4.d4 exd4 5.Bg5 Be7 6.Bxe7 Qxe7 7.Bxc6 dxc6 8.Qxd4 Nf6 9.Nc3 Bg4 10.O-O-O { This, to allow Bxf3, is the new move. } 10...Bxf3 11.gxf3 O-O 12.Qe3 Nh5 ) ( 4.O-O ) 4...a6 ( 4...d6 ) ( 4...Nge7 5.d4 exd4 6.cxd4 d5 7.exd5 Nxd5 8.O-O Bg7 9.Re1+ Be6 10.Bg5 Qd6 11.Nbd2 O-O 12.Ne4 Qb4 13.Bxc6 bxc6 14.Qc1 Rfe8 15.Bd2 Qb6 16.Nc5 Bf5 17.Ne5 ) ( 4...Bg7 ) 5.Ba4 Bg7 ( 5...d6 { Transposes } ) ( 5...Nge7 { Transposes } ) 6.d4 exd4 7.cxd4 b5 8.Bc2 d6 9.d5 Na5 10.O-O ) ( 3...Bc5 4.c3 Nf6 ( 4...f5 5.d4 fxe4 6.Bxc6 dxc6 7.Nxe5 Bd6 8.Qh5+ g6 9.Qe2 Bf5 ( 9...Qh4 10.h3 ) 10.Bf4 Nf6 11.Nd2 ) ( 4...Qf6 5.O-O Nge7 6.Re1 ) ( 4...Bb6 5.d4 exd4 6.cxd4 Nce7 7.O-O c6 8.d5 cxb5 9.d6 ) ( 4...Nge7 5.O-O Bb6 6.d4 exd4 7.cxd4 d5 8.exd5 Nxd5 9.Re1+ Be6 10.Bg5 Qd6 11.Nbd2 O-O 12.Nc4 Qb4 13.a4 ) 5.d4 exd4 ( 5...Bb6 $6 6.Nxe5 Nxe5 7.dxe5 Nxe4 8.Qg4 Bxf2+ 9.Ke2 Qh4 10.Qxg7 Rf8 11.Bh6 Bc5 12.Nd2 Qf2+ 13.Kd1 Nxd2 14.Bxd2 ) 6.e5 Nd5 ( 6...Ne4 7.O-O d5 ( 7...dxc3 $6 8.Qd5 ) 8.cxd4 Bb6 9.Nc3 ) 7.O-O Be7 ( 7...O-O $6 8.cxd4 ) 8.cxd4 d6 9.exd6 ) ( 3...Bb4 4.c3 Ba5 5.Qa4 Bb6 6.d4 ) ( 3...d6 4.d4 { Gaining space with 4.d5 Nce7 5.c4 should be very good for White also, as he has control over the entire centre. } 4...exd4 ( 4...Bd7 5.Nc3 { Transposes } 5...Nge7 ) ( 4...Bg4 5.dxe5 dxe5 6.Qd5 ) 5.Nxd4 Bd7 6.Nc3 Nf6 ( 6...g6 { 6...Nf6 transposes to avariation considered under the move order @@StartFEN@@rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1@@EndFEN@@ 1.e4 d6 2.d4 Nf6 3.Nc3 e5 4.Nf3 exd4 . As you can see, transpositions can happen in the Philidor quite regularly. Here White has many different replies to get a good position. } 7.Be3 Bg7 8.Qd2 Nf6 9.Bxc6 bxc6 10.Bh6 O-O 11.Bxg7 Kxg7 12.O-O-O ) ( 6...Nxd4 7.Bxd7+ Qxd7 8.Qxd4 ) 7.O-O Be7 { Transposes } 8.Nxc6 Bxc6 ( 8...bxc6 9.Bd3 O-O 10.f4 ) 9.Bxc6+ bxc6 10.f4 ) 4.Ba4 Nf6 ( 4...b5 5.Bb3 Na5 ( 5...Nf6 6.O-O ) ( 5...Bb7 6.d4 exd4 7.O-O Na5 8.Qxd4 d6 9.Bg5 ) ( 5...g6 6.d4 exd4 7.Nxd4 Na5 8.a4 b4 9.Ba2 Bg7 10.O-O Ne7 11.c3 ) ( 5...Bc5 6.c3 { As is often recommended with a bishop on c5. } 6...d6 7.d4 exd4 8.cxd4 Bb6 9.Nc3 Bg4 10.Be3 Nf6 11.Nd5 Nxe4 $4 12.Nxb6 ( 12.Qc2 ) 12...cxb6 13.Qc2 ) ( 5...d6 6.a4 { We are in Noah's Ark trap territory, so it is good to avoid d4. } 6...b4 7.d4 )",
        alias: 'ruylopez',
        trainAs: 'white',
      });

      this.selectSubrepertoire(0);
      // this.handleLearn();
      this.chessSrs.next();
      this.chessSrs.succeed();

      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.setMethod('learn');
      this.handleLearn();
    
      // initialize num due cache
      this.numDueCache = new Array(this.chessSrs.state.repertoire.length).fill(0); 
      console.log(this.numDueCache);
      // TODO remove me 
      this.redraw();
    });
  }

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

  // update PGN view context through this method since it will also handle setting chessground
  updatePgnViewContext = (ctx: PgnViewContext) => {
    this.pgnViewContext = {
      ...this.pgnViewContext,
      ...ctx,
    };
  };

  //TODO should be handled by ChessSrs library
  subrep = () => {
    return this.chessSrs.state.repertoire[this.chessSrs.state.index];
  };

  //TODO PGN validation
  addSubrepertoire = (newSubrep: NewSubrepertoire) => {
    this.chessSrs.addSubrepertoires(newSubrep.pgn, newSubrep.trainAs);
    this.subrepertoireNames.push(newSubrep.alias);
    this.redraw();
  };

  selectSubrepertoire = (which: number) => {
    if (which == this.chessSrs.state.index) return;
    this.chessSrs.load(which);

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
    console.log(opts);
    this.chessground!.set(opts);
    this.redraw();
  };

  atLast = () => {
    return this.pathIndex === this.path.length - 2;
  };

  makeCgOpts = (): CgConfig => {
    const fen = this.chessSrs.path()?.at(-2)?.data.fen || initial;

    console.log("comments", this.chessSrs.path()?.at(-1)?.data.comments)

    const targetSan = this.chessSrs.path()?.at(-1)?.data.san;
    const uci = calcTarget(fen, targetSan!);

    console.log(this.chessSrs.path()?.at(-2)?.data.fen);

    const config: CgConfig = {
      fen: this.path[this.pathIndex] || initial,

      turnColor: this.subrep().meta.trainAs,
      movable: {
        dests: this.atLast()
          ? this.chessSrs.state.method === 'learn'
            ? toDestMap(uci[0], uci[1])
            : fenToDests(fen)
          : new Map(),
        events: {
          after: (from: Key, to: Key) => {
            console.log('------------------------------');
            console.log('moved');
            if (this.atLast()) {
              switch (this.chessSrs.state.method) {
                case 'learn':
                  console.log('learned');
                  this.chessSrs.succeed();
                  this.handleLearn();
                  break;
                case 'recall':
                  const san = chessgroundToSan(fen, from, to);
                  //TODO be more permissive depending on config
                  switch (this.chessSrs.guess(san)) {
                    case 'success':
                      this.chessSrs.succeed();
                      this.handleRecall();
                      break;
                    case 'alternate':
                      this.chessSrs.succeed();
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
          this.chessSrs.state.method === 'learn' ? [{ orig: uci[0], dest: uci[1], brush: 'green' }] : [],
      },
    };
    return config;
  };

  handleLearn = () => {
    this.chessSrs.update();
    this.lastFeedback = 'learn';
    console.log('handleLearn');
    this.chessSrs.setMethod('learn');
    this.chessSrs.next(); // mutates path
    // update path and pathIndex
    this.path = this.chessSrs.path()!.map((p) => p.data.fen);
    this.pathIndex = this.path.length - 2;
    const opts = this.makeCgOpts();
    console.log(opts);
    this.chessground!.set(opts);
    console.log(this.chessground!.state);

    this.redraw();
  };

  handleFail = (attempt: string) => {
    console.log(attempt);
    this.lastFeedback = 'fail';
    this.redraw();
  };

  //TODO refactor common logic from learn, recall, into utility method
  handleRecall = () => {
    this.lastFeedback = 'recall';
    this.numDueCache[this.chessSrs.state.index] = this.chessSrs.countDue();

    this.chessground?.setAutoShapes([]);
    this.chessSrs.setMethod('recall');
    this.chessSrs.update();
    this.chessSrs.next();

    this.path = this.chessSrs.path()!.map((p) => p.data.fen);
    this.pathIndex = this.path.length - 2;

    const opts = this.makeCgOpts();
    console.log(opts);
    this.chessground!.set(opts);
    console.log();

    this.redraw();
  };
}
