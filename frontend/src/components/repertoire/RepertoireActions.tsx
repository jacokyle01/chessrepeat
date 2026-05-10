import React, { useState } from 'react';
import { SquareArrowOutUpRightIcon } from 'lucide-react';
import { useTrainerStore } from '../../store/state';
import Repertoire from './Repertoire';

const RepertoireActions: React.FC = () => {
  const repertoire = useTrainerStore((state) => state.repertoire);
  const [isRepertoireOpen, setIsRepertoireOpen] = useState(false);

  return (
    <>
      <div id="repertoire-actions" className="my-2 shrink-0 flex items-center justify-start gap-2 lg:hidden">
        <button
          onClick={() => setIsRepertoireOpen(true)}
          className="h-11 inline-flex items-center justify-center gap-2 rounded-md px-3 hover:shadow transition active:scale-[0.98] whitespace-nowrap border border-gray-300 bg-white"
        >
          <div className="bg-gray-200 rounded p-1">
            <SquareArrowOutUpRightIcon className="h-4 w-4 text-black" />
          </div>
          <span>View Repertoire</span>
          <span className="text-lg font-bold text-gray-500 leading-none">{repertoire.length}</span>
        </button>
      </div>

      {isRepertoireOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center lg:hidden"
          onClick={() => setIsRepertoireOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl mx-4 w-full max-h-[75vh] flex flex-col overflow-hidden border border-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <Repertoire />
          </div>
        </div>
      )}
    </>
  );
};

export default RepertoireActions;
