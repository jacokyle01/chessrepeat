import { useEffect, useRef, useState } from "react";
import { useTrainerStore } from "../state/state";

export function useStockfish() {
  const engineRef = useRef<Worker | null>(null);
  const listenersRef = useRef<((data: string) => void)[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const maybeFen = useTrainerStore((s) => s.selectedNode?.fen);

  const startEngine = () => {
    if (engineRef.current) return;
    const engine = new Worker("/stockfish.js");
    engineRef.current = engine;

    engine.onmessage = (event) => {
      listenersRef.current.forEach((cb) => cb(event.data));
    };

    engine.postMessage("uci");
    engine.postMessage("ucinewgame");
    engine.postMessage("isready");

    setEnabled(true);
  };

  const stopEngine = () => {
    engineRef.current?.terminate();
    engineRef.current = null;
    setEnabled(false);
    setLines([]);
  };

  // Internal function to run analysis
  const runAnalysis = (fen: string, depth = 15) => {
    if (!enabled || !engineRef.current) return;

    const newLines: any[] = [];

    const handler = (msg: string) => {
      if (msg.includes("multipv")) {
        const parts = msg.split(" pv ");
        if (parts.length < 2) return;
        const pv = parts[1];
        const multipvMatch = msg.match(/multipv (\d+)/);
        const scoreMatch = msg.match(/score (cp|mate) (-?\d+)/);

        if (multipvMatch && scoreMatch) {
          const multipv = Number(multipvMatch[1]);
          const type = scoreMatch[1];
          const score =
            type === "cp" ? Number(scoreMatch[2]) : `mate ${scoreMatch[2]}`;
          newLines[multipv - 1] = { line: pv, score };
        }
      }
      if (msg.startsWith("bestmove")) {
        listenersRef.current = listenersRef.current.filter(
          (cb) => cb !== handler
        );
        setLines(newLines.filter(Boolean));
      }
    };

    listenersRef.current.push(handler);

    engineRef.current?.postMessage(`position fen ${fen}`);
    engineRef.current?.postMessage(`go depth ${depth} multipv 3`);
  };

  // Whenever FEN changes and engine is enabled → run analysis
  useEffect(() => {
    if (enabled && maybeFen) {
      runAnalysis(maybeFen, 15);
    }
  }, [maybeFen, enabled]);

  return { enabled, startEngine, stopEngine, lines };
}
