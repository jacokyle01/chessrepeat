import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { useTrainerStore } from "../../state/state";

const PgnControls = (jump: (index: number) => void) => {
  //TODO store these f's within store
  let atLast = useTrainerStore.getState().pathIndex === useTrainerStore.getState().trainingPath.length - 2;
  const pathIndex = useTrainerStore((s) => s.pathIndex);
  const trainingPath = useTrainerStore((s) => s.trainingPath);

  return (
    <div id="pgn-control" className="flex justify-between w-3/4 mt-3 items-center m-auto">
      <button onClick={() => jump(0)}>{<ChevronFirst />}</button>
      <button onClick={() => jump(Math.max(0, pathIndex - 1))}>{<ChevronLeft />}</button>
      <button onClick={() => jump(Math.min(trainingPath.length - 2, pathIndex + 1))}>
        {<ChevronRight />}
      </button>
      <button onClick={() => jump(trainingPath.length - 2)} className={!atLast ? 'animate-pulse-blue' : ''}>
        {<ChevronLast />}
      </button>
    </div>
  );
};

export default PgnControls;