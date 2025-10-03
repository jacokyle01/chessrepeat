import React, { useEffect, useState, useCallback } from 'react';
import debounce from 'lodash.debounce';
import { useTrainerStore } from '../state/state';
import { BookText, Percent, Sigma, Swords } from 'lucide-react';
import { ChessPiece } from './ChessPiece';

const Explorer: React.FC = () => {
  const selectedNode = useTrainerStore.getState().selectedNode;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchOpeningData = useCallback(
    debounce(async (fen: string) => {
      if (!fen) return;

      try {
        setLoading(true);
        setData(null);

        const res = await fetch(
          `https://explorer.lichess.ovh/masters?variant=standard&fen=${encodeURIComponent(
            fen,
          )}&moves=6&topGames=0&recentGames=0`,
        );

        if (!res.ok) throw new Error(`Error fetching opening data: ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 400),
    [],
  );

  useEffect(() => {
    if (selectedNode?.fen) {
      fetchOpeningData(selectedNode.fen);
    }
  }, [selectedNode?.fen, fetchOpeningData]);

  console.log("data", data);
  if (!data || data.moves.length == 0) return <div>{loading ? 'Loading...' : 'No data'}</div>;

  const totalGames = data.moves.reduce(
    (sum: number, move: any) => sum + move.white + move.draws + move.black,
    0,
  );

  return (
    <div className="opening-explorer">
      <div className="explorer-header bg-blue-600/75 p-1 rounded-md">
        <div id="explorer-header" className="flex flex-row items-center justify-left gap-2">
          <div id="explorer-icon-wrap" className="text-white rounded">
            {/* <BookOpenIcon></BookOpenIcon>
             */}
            <BookText />
          </div>
          <span className="text-gray-800 font-semibold text-xl text-white">Opening Explorer</span>
        </div>{' '}
        {/* Move SAN */}
        <div className="column-headers flex items-center text-white space-x-2">
          {/* SAN / ChessPiece */}
          <div className="w-12 font-semibold flex justify-start">
            <ChessPiece />
          </div>

          {/* Move percentage */}
          <div className="w-16 flex justify-end">
            <Percent />
          </div>

          {/* Total moves */}
          <div className="w-12 flex justify-end">
            <Sigma />
          </div>

          {/* Win/Draw/Loss */}
          <div className="flex-1"><Swords/></div>
        </div>
      </div>
      <ul className="bg-white">
        {data.moves.map((move: any, index: number) => {
          const moveTotal = move.white + move.draws + move.black;
          const movePct = totalGames ? (moveTotal / totalGames) * 100 : 0;

          const whitePct = moveTotal ? (move.white / moveTotal) * 100 : 0;
          const drawPct = moveTotal ? (move.draws / moveTotal) * 100 : 0;
          const blackPct = moveTotal ? (move.black / moveTotal) * 100 : 0;

          return (
            <li
              key={move.san}
              className={`flex items-center space-x-2 ${index % 2 == 0 ? 'bg-white' : 'bg-gray-100'} p-1`}
            >
              {/* Move SAN */}
              <span className="w-12 font-semibold">{move.san}</span>
              {/* Move percentage */}
              <span className="w-16 text-right">{movePct.toFixed(1)}%</span>
              {/* Total moves */}
              <span className="w-12 text-right">{moveTotal}</span>
              {/* Win/Draw/Loss bar */}
              <div className="flex flex-1 h-6 rounded overflow-hidden border border-gray-300 relative">
                {whitePct > 0 && (
                  <div
                    className="bg-white flex items-center justify-center text-black text-xs font-semibold"
                    style={{ width: `${whitePct}%` }}
                  >
                    {whitePct >= 10 ? `${whitePct.toFixed(0)}%` : ''}
                  </div>
                )}
                {drawPct > 0 && (
                  <div
                    className="bg-gray-400 flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: `${drawPct}%` }}
                  >
                    {drawPct >= 10 ? `${drawPct.toFixed(0)}%` : ''}
                  </div>
                )}
                {blackPct > 0 && (
                  <div
                    className="bg-black flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: `${blackPct}%` }}
                  >
                    {blackPct >= 10 ? `${blackPct.toFixed(0)}%` : ''}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Explorer;