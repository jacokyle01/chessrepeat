// TODO error handling 
// TODO cache positions on the frontend 

import React, { useEffect, useState, useCallback } from "react";
//TODO dont bring in lodash for this?
import debounce from "lodash.debounce";
import { useTrainerStore } from "../state/state";

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
          `https://explorer.lichess.ovh/lichess?variant=standard&fen=${encodeURIComponent(fen)}&moves=10&topGames=0&recentGames=0`
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
    []
  );

  useEffect(() => {
    if (selectedNode?.fen) {
      fetchOpeningData(selectedNode.fen);
    }
  }, [selectedNode?.fen, fetchOpeningData]);

  return (
    <div className="opening-explorer">
      {loading && <p>Loading opening data...</p>}
      {!loading && data && (
        <div>
          <h3>Moves</h3>
          <ul>
            {data.moves?.map((move: any) => (
              <li key={move.san}>
                {move.san} — {move.white}W / {move.draws}D / {move.black}B
              </li>
            ))}
          </ul>
        </div>
      )}
      {!loading && !data && <p>No data</p>}
    </div>
  );
}

export default Explorer;
