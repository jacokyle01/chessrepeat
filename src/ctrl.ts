import { Api } from 'chessground/api';
import { NewSubrepertoire, Redraw, ToastPopup } from './types/types';
import { ChessSrs } from 'chess-srs';
import { initial } from 'chessground/fen';
import { Key } from 'chessground/types';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap} from './util';

export default class PrepCtrl {
  //TODO call these "plans"
  subrepertoireNames: string[] = [];

  //libraries
  chessground: Api | undefined; // stores FEN
  chessSrs = ChessSrs({
    buckets: [1, 11, 111],
    getNext: {
      by: 'depth',
    },
  }); //stores training data
  // chess: Chess = new Chess(); // provided with current PGN path
  addingNewSubrep = false;
  toastMessage: ToastPopup | null = null;
  constructor(readonly redraw: Redraw) {
    //we are initially learning
    document.addEventListener('DOMContentLoaded', (_) => {
      this.chessSrs.setMethod('learn');
      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc1 Bxd2+ 8. Qxd2 b5 9. Qg5',
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
        pgn: "1.e4 e5 2.Nf3 Nc6 ( 2...d6 { Test } 3.d4 { White immediately challenges Black in the centre. } ) ( 2...Qe7 {  } 3.Bc4 { White puts pressure on f7 and plans to castle quickly, before opening the centre with d2-d4. } 3...d6 4.O-O ) 3.Bb5 a6 ( 3...Nf6 4.d3 Bc5 ( 4...d6 5.O-O Bd7 ( 5...Be7 6.h3 O-O ( 6...a6 7.Bxc6+ bxc6 8.Nc3 ) 7.c4 ) ( 5...g6 6.d4 Bd7 ( 6...exd4 7.e5 dxe5 8.Nxe5 ) 7.d5 ) ( 5...a6 6.Bxc6+ bxc6 7.Re1 Be7 ( 7...c5 8.c3 {[%cal Gd3d4]} ) 8.d4 { Transposes to Averbakh Variation } ) 6.Re1 g6 7.d4 Bg7 8.d5 Ne7 9.Bxd7+ Nxd7 ) ( 4...Bd6 5.O-O ) ( 4...Ne7 5.Bc4 {[%cal Rf3e5][%csl Re5]} c6 6.Nc3 ) 5.Bxc6 dxc6 ( 5...bxc6 6.Nxe5 ) 6.Qe2 ( 6.Nc3 Qe7 7.h3 Bd7 ( 7...h6 8.Be3 ) 8.Qe2 O-O-O ) 6...Nd7 ( 6...Qe7 7.Nbd2 O-O 8.Nc4 ) ( 6...Bg4 7.h3 Bxf3 8.Qxf3 ) ( 6...Bd6 7.Nbd2 ) 7.Nbd2 O-O 8.Nc4 Re8 9.h4 b5 10.Ne3 Nf8 11.a4 ) ( 3...Qf6 4.O-O ) ( 3...f5 4.d3 fxe4 ( 4...Nf6 5.exf5 Bc5 ( 5...d6 6.O-O Bxf5 7.d4 ) 6.O-O O-O 7.Be3 Nd4 8.c3 ) ( 4...d6 5.exf5 Bxf5 6.d4 ) 5.dxe4 Nf6 6.O-O Bc5 ( 6...d6 7.Bc4 {[%cal Gf3g5][%csl Gg5]} Bg4 8.h3 Bh5 9.Nc3 Qd7 10.Nd5 O-O-O 11.Qd3 Kb8 12.b4 ) 7.Qd3 ( 7.Bxc6 bxc6 8.Nxe5 O-O 9.Nc3 d6 ( 9...Ba6 10.Nd3 Bb6 11.Bg5 ) 10.Na4 Qe8 11.Nd3 Bg4 12.Qe1 Bd4 13.c3 Bb6 14.Nxb6 axb6 15.f3 Be6 16.a3 Bc4 17.Qd1 ) 7...d6 ( 7...Nd4 8.Nxd4 Bxd4 9.Bc4 ) ( 7...Qe7 8.Nc3 ) ( 7...O-O 8.Qc4+ ) 8.Qc4 Qe7 ( 8...Bd7 9.Nc3 Qe7 ) 9.Nc3 Bd7 ( 9...a6 10.Bxc6+ bxc6 11.Be3 ) 10.Nd5 Nxd5 11.exd5 { Transposes. } 11...Nd4 12.Bxd7+ Qxd7 13.Nxe5 Qf5 14.Nd3 O-O-O 15.Kh1 ) ( 3...Nd4 4.Nxd4 exd4 5.O-O Bc5 ( 5...c6 6.Bc4 Nf6 ( 6...d5 7.exd5 cxd5 8.Bb5+ Bd7 9.Re1+ Ne7 10.c4 ) 7.d3 d5 8.exd5 Nxd5 9.Re1+ ) 6.Bc4 d6 7.d3 Ne7 8.f4 ) ( 3...Nge7 4.Nc3 ( 4.O-O ) ( 4.d4 exd4 5.Nxd4 Nxd4 ( 5...g6 6.Nxc6 Nxc6 ( 6...bxc6 7.Qd4 { This is the point of Bxc6. In reality, Black would rather capture this way to prepare d5. } ) 7.Nc3 Bg7 8.Be3 ) ( 5...Ng6 6.Be3 { Makes Bc5 less appetizing. } 6...Be7 7.Nc3 O-O 8.h4 ) 6.Qxd4 Nc6 7.Qe3 Be7 8.Nc3 O-O 9.O-O ) 4...g6 ( 4...d6 5.d4 a6 ( 5...Bd7 6.d5 ) ( 5...exd4 6.Nxd4 ) 6.Bc4 ) ( 4...Ng6 5.d4 exd4 6.Nxd4 Bc5 7.Be3 ) ( 4...a6 5.Bc4 Ng6 6.d4 ) 5.d4 exd4 ( 5...Bg7 6.dxe5 ) 6.Nd5 Bg7 ( 6...Nxd5 ) 7.Bg5 h6 8.Bf6 Bxf6 ( 8...Kf8 9.Bxg7+ Kxg7 10.Bxc6 Nxc6 11.Qd3 ) 9.Nxf6+ Kf8 10.Qd2 d5 ( 10...Ng8 11.Nxg8 Kxg8 12.O-O-O ) ( 10...a6 11.Bc4 Ng8 12.Nd5 ) ( 10...d6 11.O-O-O ) 11.Bxc6 Nxc6 12.Nxd5 Bf5 13.Qf4 Bxe4 14.Qxe4 Qd6 15.Nxc7 Qxc7 16.O-O-O Re8 17.Qh4 ) ( 3...g6 4.c3 ( 4.d4 exd4 5.Bg5 Be7 6.Bxe7 Qxe7 7.Bxc6 dxc6 8.Qxd4 Nf6 9.Nc3 Bg4 10.O-O-O { This, to allow Bxf3, is the new move. } 10...Bxf3 11.gxf3 O-O 12.Qe3 Nh5 ) ( 4.O-O ) 4...a6 ( 4...d6 ) ( 4...Nge7 5.d4 exd4 6.cxd4 d5 7.exd5 Nxd5 8.O-O Bg7 9.Re1+ Be6 10.Bg5 Qd6 11.Nbd2 O-O 12.Ne4 Qb4 13.Bxc6 bxc6 14.Qc1 Rfe8 15.Bd2 Qb6 16.Nc5 Bf5 17.Ne5 ) ( 4...Bg7 ) 5.Ba4 Bg7 ( 5...d6 { Transposes } ) ( 5...Nge7 { Transposes } ) 6.d4 exd4 7.cxd4 b5 8.Bc2 d6 9.d5 Na5 10.O-O ) ( 3...Bc5 4.c3 Nf6 ( 4...f5 5.d4 fxe4 6.Bxc6 dxc6 7.Nxe5 Bd6 8.Qh5+ g6 9.Qe2 Bf5 ( 9...Qh4 10.h3 ) 10.Bf4 Nf6 11.Nd2 ) ( 4...Qf6 5.O-O Nge7 6.Re1 ) ( 4...Bb6 5.d4 exd4 6.cxd4 Nce7 7.O-O c6 8.d5 cxb5 9.d6 ) ( 4...Nge7 5.O-O Bb6 6.d4 exd4 7.cxd4 d5 8.exd5 Nxd5 9.Re1+ Be6 10.Bg5 Qd6 11.Nbd2 O-O 12.Nc4 Qb4 13.a4 ) 5.d4 exd4 ( 5...Bb6 $6 6.Nxe5 Nxe5 7.dxe5 Nxe4 8.Qg4 Bxf2+ 9.Ke2 Qh4 10.Qxg7 Rf8 11.Bh6 Bc5 12.Nd2 Qf2+ 13.Kd1 Nxd2 14.Bxd2 ) 6.e5 Nd5 ( 6...Ne4 7.O-O d5 ( 7...dxc3 $6 8.Qd5 ) 8.cxd4 Bb6 9.Nc3 ) 7.O-O Be7 ( 7...O-O $6 8.cxd4 ) 8.cxd4 d6 9.exd6 ) ( 3...Bb4 4.c3 Ba5 5.Qa4 Bb6 6.d4 ) ( 3...d6 4.d4 { Gaining space with 4.d5 Nce7 5.c4 should be very good for White also, as he has control over the entire centre. } 4...exd4 ( 4...Bd7 5.Nc3 { Transposes } 5...Nge7 ) ( 4...Bg4 5.dxe5 dxe5 6.Qd5 ) 5.Nxd4 Bd7 6.Nc3 Nf6 ( 6...g6 { 6...Nf6 transposes to avariation considered under the move order @@StartFEN@@rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1@@EndFEN@@ 1.e4 d6 2.d4 Nf6 3.Nc3 e5 4.Nf3 exd4 . As you can see, transpositions can happen in the Philidor quite regularly. Here White has many different replies to get a good position. } 7.Be3 Bg7 8.Qd2 Nf6 9.Bxc6 bxc6 10.Bh6 O-O 11.Bxg7 Kxg7 12.O-O-O ) ( 6...Nxd4 7.Bxd7+ Qxd7 8.Qxd4 ) 7.O-O Be7 { Transposes } 8.Nxc6 Bxc6 ( 8...bxc6 9.Bd3 O-O 10.f4 ) 9.Bxc6+ bxc6 10.f4 ) 4.Ba4 Nf6 ( 4...b5 5.Bb3 Na5 ( 5...Nf6 6.O-O ) ( 5...Bb7 6.d4 exd4 7.O-O Na5 8.Qxd4 d6 9.Bg5 ) ( 5...g6 6.d4 exd4 7.Nxd4 Na5 8.a4 b4 9.Ba2 Bg7 10.O-O Ne7 11.c3 ) ( 5...Bc5 6.c3 { As is often recommended with a bishop on c5. } 6...d6 7.d4 exd4 8.cxd4 Bb6 9.Nc3 Bg4 10.Be3 Nf6 11.Nd5 Nxe4 $4 12.Nxb6 ( 12.Qc2 ) 12...cxb6 13.Qc2 ) ( 5...d6 6.a4 { We are in Noah's Ark trap territory, so it is good to avoid d4. } 6...b4 7.d4 ) ( 5...Be7 6.d4 exd4 7.c3 { This move works well due to a tactical subtlety. } 7...dxc3 $4 ( 7...Na5 8.Qxd4 Nxb3 9.axb3 ) 8.Qd5 ) 6.O-O d6 ( 6...Nxb3 7.axb3 d6 8.d4 ) 7.d4 exd4 ( 7...Nxb3 8.axb3 f6 ( 8...exd4 9.Nxd4 Bb7 10.Re1 ) 9.Nc3 Bb7 10.Qd3 {[%cal Gf1d1,Gc3d5][%csl Gd1,Gd5]} ) ( 7...f6 8.Bxg8 Rxg8 9.a4 ) 8.Re1 { A rare move. } 8...Nxb3 ( 8...Bb7 9.c3 ) ( 8...c5 9.Bd5 ) 9.axb3 c5 10.c3 Be7 11.cxd4 Nf6 12.Nc3 ) ( 4...f5 5.d4 exd4 ( 5...fxe4 6.Nxe5 Nf6 7.O-O Bd6 8.Nc3 ) 6.e5 Bc5 ( 6...b5 7.Bb3 Bb7 ) 7.O-O Nge7 8.c3 dxc3 9.Nxc3 d5 ( 9...O-O 10.Nd5 ) 10.Bg5 ) ( 4...Nge7 5.c3 ( 5.d4 exd4 ( 5...b5 6.Bb3 exd4 7.Nxd4 Nxd4 8.Qxd4 ) 6.Nxd4 Nxd4 7.Qxd4 b5 ( 7...Nc6 8.Qd3 ) 8.Bb3 Nc6 ( 8...Bb7 9.O-O Nc6 10.Qd3 ) ) 5...g6 { Transposes } ( 5...d6 6.d4 Bd7 7.d5 Nb8 8.Bxd7+ ) ( 5...Ng6 6.d4 ) 6.d4 exd4 7.cxd4 b5 ( 7...Bg7 8.d5 Na5 $6 ( 8...b5 9.Bc2 { Transposes } ) 9.Bd2 ) 8.Bc2 d5 ( 8...Bg7 9.d5 { Transposes } 9...Na5 ( 9...Nb4 10.Bb3 a5 11.a3 Na6 12.O-O ) 10.Bd2 {[%cal Gd2c3,Gc3a5][%csl Gc3,Ga5]} c5 ( 10...Nc4 11.Bc3 Bxc3+ 12.Nxc3 d6 13.Qc1 {[%cal Gc1h6][%csl Gh6]} ) 11.Bc3 ) 9.exd5 Nxd5 ( 9...Nb4 10.Bb3 Nbxd5 11.O-O Bg7 12.Bg5 Qd6 13.Nbd2 ) 10.O-O ) ( 4...g6 5.d4 exd4 ( 5...b5 6.Bb3 ) 6.Nxd4 Bg7 7.Nxc6 bxc6 ( 7...dxc6 8.Qxd8+ Kxd8 9.Bb3 ) 8.O-O Ne7 9.Nc3 O-O ) ( 4...Bc5 5.c3 Nge7 ( 5...Nf6 6.d4 Ba7 7.O-O ) 6.O-O ( 6.d3 ) ( 6.d4 exd4 7.cxd4 Bb4+ 8.Nc3 d5 9.O-O dxe4 10.Nxe4 O-O ) 6...Ng6 7.d4 Ba7 8.Bg5 f6 9.Be3 O-O 10.Nbd2 ) ( 4...d6 5.O-O { The inclusion of a6 proves favorable for Black, as 5. d4 ran into b5 Bb3 cxd4 and White cannot recapture due to the Noah's Ark trap. } 5...Bd7 ( 5...Nf6 { Steinitz Deferred } ) ( 5...Bg4 6.h3 h5 ( 6...Bh5 7.c3 Nf6 8.d4 ) 7.Bxc6+ bxc6 8.d4 Bxf3 ( 8...Qf6 9.Nbd2 g5 10.dxe5 dxe5 11.Nc4 ) 9.Qxf3 exd4 10.Re1 Qf6 11.Qb3 Ne7 12.Qb7 Rc8 13.Nd2 ) 6.c3 g6 ( 6...g5 7.d4 g4 8.Ne1 h5 9.f4 exd4 10.cxd4 d5 11.Nd3 {[%cal Gd3e5][%csl Ge5]} dxe4 12.Ne5 ) ( 6...Nf6 7.Re1 { Modern Steinitz } ) ( 6...Nge7 7.d4 Ng6 8.d5 Nb8 9.Bxd7+ Nxd7 10.c4 Be7 11.Nc3 O-O ) 7.d4 Bg7 8.h3 Nf6 ( 8...b5 9.Bc2 ) 9.Re1 { Transposes } ) ( 4...Be7 5.O-O ) 5.O-O Be7 ( 5...Nxe4 6.d4 ( 6.Re1 ) 6...b5 ( 6...Be7 7.Re1 b5 ( 7...f5 8.Nxe5 Nxe5 9.dxe5 ) 8.Rxe4 d5 9.Nxe5 Nxe5 10.Rxe5 bxa4 11.Qe2 ) ( 6...exd4 7.Re1 d5 8.Nxd4 Bd6 9.Nxc6 Bxh2+ 10.Kh1 Qh4 11.Rxe4+ dxe4 12.Qd8+ Qxd8 13.Nxd8+ Kxd8 14.Kxh2 Be6 15.Be3 f5 16.Nd2 ) 7.Bb3 d5 8.dxe5 Be6 9.Qe2 Bc5 ( 9...Be7 10.Rd1 ( 10.c3 O-O ( 10...Nc5 11.Bc2 ) 11.Bc2 Qd7 12.Nbd2 ) 10...O-O ( 10...Nc5 11.Nc3 Nxb3 12.cxb3 O-O 13.Be3 Qd7 14.Rd2 ) ( 10...Na5 11.c3 Nxb3 12.axb3 O-O 13.Nd4 ) 11.c3 Qd7 ( 11...Nc5 12.Bc2 Bg4 13.Nbd2 ) 12.Nbd2 ) ( 9...Nc5 10.Rd1 Nxb3 11.axb3 Be7 12.c4 b4 13.Nbd2 ) 10.Nbd2 Nxd2 ( 10...Bf5 11.Nxe4 Bxe4 12.a4 ) 11.Bxd2 O-O 12.c3 ( 12.Rad1 Bg4 ) ) ( 5...Bc5 6.c3 b5 ( 6...O-O 7.d4 Ba7 8.Re1 ( 8.Bg5 h6 ( 8...exd4 9.cxd4 h6 10.Bh4 ) 9.Bh4 exd4 ( 9...d6 10.Bxc6 bxc6 11.Nbd2 ) 10.cxd4 d6 11.Nc3 ) 8...d6 ( 8...b5 9.Bc2 ) 9.h3 b5 10.Bc2 h6 11.Be3 Re8 12.Nbd2 Bb7 13.a3 ) 7.Bc2 d5 ( 7...d6 8.d4 Bb6 9.a4 Bg4 10.h3 Bh5 11.d5 Ne7 12.axb5 axb5 13.Rxa8 Qxa8 14.Na3 ) 8.a4 ( 8.Nxe5 Nxe5 9.d4 dxe4 10.dxe5 Qxd1 11.Rxd1 Ng4 12.Bxe4 Nxf2 13.Bc6+ Ke7 14.Rd5 Bb6 15.Bg5+ f6 16.exf6+ gxf6 17.Bh4 Ng4+ 18.Kh1 Rb8 19.Nd2 Be6 20.Rh5 Nf2+ 21.Bxf2 Bxf2 22.Rf1 Be3 23.Ne4 ) 8...dxe4 9.axb5 exf3 ( 9...Bg4 10.bxc6 exf3 11.gxf3 Bh3 12.Re1 O-O 13.Ra5 ) 10.Qxf3 e4 11.Bxe4 Ne5 12.Qe2 O-O 13.d4 Bg4 14.Qc2 Nxe4 15.Qxe4 Nf3+ 16.gxf3 Bh3 17.dxc5 ) ( 5...b5 6.Bb3 Bb7 ( 6...Bc5 7.a4 ( 7.c3 d6 8.d4 Bb6 9.Be3 { Has a better winrate, and appears to be simpler than a4. } ( 9.a4 Bg4 10.h3 Bh5 ) 9...O-O ( 9...Bg4 10.Nbd2 O-O ( 10...exd4 11.cxd4 Nxd4 12.Bxd4 Bxd4 13.Bxf7+ Kxf7 14.Qb3+ Kf8 15.Nxd4 ) 11.h3 Bh5 12.dxe5 Nxe5 13.Bxb6 cxb6 14.g4 Bg6 15.Nd4 ) 10.Nbd2 h6 ( 10...Re8 11.h3 ) 11.h3 Re8 12.Re1 exd4 13.cxd4 Nb4 14.Qe2 ) 7...Rb8 ( 7...Bb7 8.c3 d6 9.d4 Bb6 10.Re1 { Transposes } ( 10.a5 Nxa5 11.Rxa5 Bxa5 12.dxe5 dxe5 13.Nxe5 ) ) ( 7...b4 8.Nxe5 Nxe5 9.d4 Bxd4 10.Qxd4 ) 8.c3 d6 ( 8...O-O 9.d4 Bb6 10.dxe5 Ng4 11.a5 Ba7 12.Bf4 Qe7 13.e6 dxe6 14.e5 ) 9.d4 Bb6 10.a5 { Black will face many problems from allowing a5. } 10...Ba7 ( 10...Bxa5 11.d5 ) ( 10...Nxa5 11.Rxa5 Bxa5 12.dxe5 ) 11.h3 { White cannot allow Black's LSB to put pressure on his center. } 11...O-O ( 11...Bb7 {[%cal Rf6e4][%csl Re4]} 12.Be3 { Setting up a myriad of problems relating to d5 and the pressure on e5. Already d5 is a threat. } 12...Nxe4 13.Re1 exd4 14.cxd4 Ne7 15.Nbd2 d5 16.Rc1 ) ( 11...h6 12.Be3 { Setting up a myriad of problems relating to d5 and the pressure on e5. Already dxe5 is a threat. } 12...Ra8 13.Re1 O-O 14.Nbd2 ) 12.Be3 { Setting up a myriad of problems relating to d5 and the pressure on e5. Already dxe5 is a threat. } 12...Ra8 ( 12...exd4 13.cxd4 Nb4 ( 13...Nxe4 14.Qc2 ( 14.Bd5 Qe8 15.Re1 Nf6 16.Bg5 Nxd5 17.Rxe8 Rxe8 18.Nc3 ) 14...Qe8 15.Nc3 ) 14.Nc3 Bb7 15.Ng5 ) ( 12...Re8 13.Ng5 Rf8 14.Re1 ) ( 12...Nxe4 13.Bd5 exd4 14.cxd4 ) 13.Nbd2 h6 ( 13...Re8 14.Re1 ) ( 13...Bb7 14.Re1 ) 14.Re1 ( 14.Qe2 ) 14...Re8 15.Qc2 { Preparing to swing the knight to f1 when e4 is defended. } 15...exd4 { cxd4 there is Nb4 soon } 16.Bxd4 ) ( 6...Nxe4 { This is not the Open Ruy, because the inclusion of b5 Bb3 means that Black cannot meet Re1 with Nc5. } 7.Re1 d5 ( 7...Nc5 8.Bd5 ) 8.Nc3 Nxc3 9.dxc3 Be6 10.a4 b4 11.a5 ) ( 6...Be7 7.Re1 ) ( 6...d6 7.c3 Na5 ( 7...Be7 8.Re1 { Transposes } ) 8.Bc2 c5 9.d4 Qc7 10.d5 ) 7.Re1 ( 7.d3 { Solidly protecting e4. } 7...Be7 ( 7...Bc5 8.a4 ( 8.Be3 d6 9.Bxc5 dxc5 10.a4 O-O ) 8...O-O ( 8...d6 ) ( 8...b4 ) ) ( 7...Bd6 8.a4 O-O 9.Nc3 b4 10.Ne2 Na5 11.Ba2 h6 12.Ng3 Re8 13.Nh4 ) 8.c4 bxc4 ( 8...O-O 9.Nc3 bxc4 10.Bxc4 ) ( 8...b4 9.Ba4 d6 10.d4 O-O 11.d5 ) ( 8...d6 9.Nc3 bxc4 10.Bxc4 O-O ) 9.Bxc4 O-O 10.Nc3 d6 11.a3 Nd4 12.Be3 c5 13.Rb1 ) 7...Be7 { Trajkovic counterattack } { Transposes to Trajkovic } ( 7...Bc5 8.c3 d6 ( 8...O-O ) ( 8...Bb6 9.d4 O-O 10.Be3 ) 9.d4 ( 9.d3 ) 9...Bb6 10.a4 { Transposes } ( 10.Be3 O-O 11.Nbd2 ) 10...O-O ( 10...h6 11.Be3 exd4 ( 11...O-O 12.d5 ) ( 11...Ng4 12.Bd5 Nxe3 13.fxe3 ) 12.cxd4 Na5 13.Bc2 ) 11.Bg5 h6 12.Bh4 exd4 ( 12...g5 13.Nxg5 hxg5 14.Bxg5 ) ( 12...Re8 13.axb5 axb5 14.Rxa8 Bxa8 15.d5 ) 13.cxd4 g5 14.Nxg5 hxg5 15.Bxg5 Nxd4 16.Bd5 ) ) ( 5...d6 { Steinitz Deferred } 6.Re1 b5 ( 6...Bg4 7.c3 Be7 { Averbakh Variation } ) ( 6...Bd7 7.c3 { Modern Steinitz } 7...Be7 ( 7...g6 8.d4 Bg7 9.h3 { Transposes } 9...O-O 10.Bc2 Nh5 {[%cal Gf7f5]}",
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
    });
  }

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
    this.chessground?.set({
      fen: initial,
    });
    this.toastMessage = null;
    console.log(this.subrep().meta);
    this.redraw();
  };

  toggleAddingNewSubrep = () => {
    this.addingNewSubrep = this.addingNewSubrep ? false : true;
    this.redraw();
  };

  handleMethodSwitch = () => {
    this.chessground?.setAutoShapes([]);
  };

  handleLearn = () => {
    this.handleMethodSwitch();
    this.chessSrs.setMethod('learn');
    this.chessSrs.next();
    const fen = this.chessSrs.path()?.at(-2)?.data.fen || initial
    const targetSan = this.chessSrs.path()?.at(-1)?.data.san;
    const uci = calcTarget(fen, targetSan!);
    this.chessground?.set({
      //TODO determine color from subrepertoire
      //currently, it doesn't look like chessSrs has this functionality
      //ideally, extend 'Game' with metadeta about the subrepertoire
      turnColor: 'white',
      fen: fen,
      //TODO redraw() here
      movable: {
        dests: toDestMap(uci[0], uci[1]),
        events: {
          after: () => {
            this.chessSrs.succeed();
            this.handleLearn();
          },
        },
      },
    });
    this.chessground?.setAutoShapes([{ orig: uci[0], dest: uci[1], brush: 'green' }]);

    //update toast
    this.toastMessage = {
      type: 'learn',
      header: 'New move',
      message: 'White plays his move.'
       // message: `White plays ${last!.san}`,14
    };

    this.redraw();
  };

  handleFail = (attempt: string) => {
    this.toastMessage = {
      type: 'fail',
      header: '',
      message: `Incorrect. ${attempt} is not the right move.`,
    };
    this.redraw();
  };

  //TODO refactor common logic from learn, recall, into utility method
  handleRecall = () => {
    this.handleMethodSwitch();
    this.chessground?.setAutoShapes([]);
    this.chessSrs.setMethod('recall');
    this.chessSrs.update();
    this.chessSrs.next();
    const fen = this.chessSrs.path()?.at(-2)?.data.fen || initial

    this.chessground?.set({
      //TODO determine color from subrepertoire
      //currently, it doesn't look like chessSrs has this functionality
      //ideally, extend 'Game' with metadeta about the subrepertoire
      turnColor: 'white',
      fen: fen,
      //TODO redraw() here
      movable: {
        dests: fenToDests(fen),

        events: {
          after: (from: Key, to: Key) => {
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
          },
        },
      },
    });
    //update toast
    this.toastMessage = {
      type: 'recall',
      header: 'New move',
      message: `What does White play here?`,
    };

    this.redraw();
  };
}
