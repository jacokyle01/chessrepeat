import React, { useState } from 'react';
import { Chess } from 'chess.js';
import Chessboard from './components/Chessboard';

// const pgn = 'd4 d5 c4 e6 Nf3 Nf6 g3';
// const moves = pgn.split(' ');

// const ChessOpeningTrainer: React.FC = () => {
//   const [game, setGame] = useState(new Chess());
//   const [moveIndex, setMoveIndex] = useState(0);
//   const [message, setMessage] = useState('Your move (White)');

//   const onDrop = (sourceSquare: string, targetSquare: string) => {
//     const move = {
//       from: sourceSquare,
//       to: targetSquare,
//       promotion: 'q',
//     };

//     const expectedMove = moves[moveIndex];
//     const tempGame = new Chess(game.fen());
//     const result = tempGame.move(move);

//     if (result && result.san === expectedMove) {
//       setGame(tempGame);
//       setMoveIndex(moveIndex + 1);
//       setMessage('✔ Correct');

//       setTimeout(() => {
//         const blackMove = moves[moveIndex + 1];
//         if (blackMove) {
//           const updatedGame = new Chess(tempGame.fen());
//           updatedGame.move(blackMove);
//           setGame(updatedGame);
//           setMoveIndex((prev) => prev + 1);
//         }
//       }, 400);
//     } else {
//       setMessage(`✘ Incorrect. Expected: ${expectedMove}`);
//     }
//   };

//   return (
//     <div className="flex flex-col items-center p-4">
//       <h1 className="text-xl mb-2 font-semibold">Chess Opening Trainer</h1>
//       <p className="mb-2">{message}</p>
//       <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={400} />
//     </div>
//   );
// };

// export default ChessOpeningTrainer;

import { useEffect, useRef } from "react";
// import Chessground, { Api, Config, Key } from "@react-chess/chessground";

// these styles must be imported somewhere
// import "chessground/assets/chessground.base.css";
// import "chessground/assets/chessground.brown.css";
// import "chessground/assets/chessground.cburnett.css";

const CONFIG: Config = {
  movable: { free: false },
};

// Demo game moves in long algebraic form
const MOVES = (
  "e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 " +
  "f1c4 g8f6 f3b3 d8e7 b1c3 c7c6 c1g5 b7b5 c3b5 c6b5 " +
  "c4b5 b8d7 e1c1 a8d8 d1d7 d8d7 h1d1 e7e6 b5d7 f6d7 " +
  "b3b8 d7b8 d1d8"
).split(" ");

export const ChessOpeningTrainer = () => {
  const apiRef = useRef<Api | undefined>();

  useEffect(() => {
    // Make a move every 2 seconds
    const interval = setInterval(() => {
      const move = MOVES.shift();
      if (move) {
        apiRef.current!.move(move.substring(0,2) as Key, move.substring(2,4) as Key);
      } else {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  });

  return (
    <Chessboard
        width={640} height={640}
        config={CONFIG} ref={apiRef}
    />
  );
}
export default ChessOpeningTrainer;
