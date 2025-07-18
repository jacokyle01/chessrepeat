import React from 'react';
import PrepCtrl from '../ctrl';
import { returnI } from '../svg/return';
import { ArrowBigLeftDash } from 'lucide-react';
import { useTrainerStore } from '../state/state';

const SettingsModal: React.FC = () => {
    const setShowTrainingSettings= useTrainerStore((state) => state.setShowTrainingSettings);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg p-6 relative">
        {/* Close button */}
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
          // onClick={onClose}
        >
          &times;
        </button>

        <button
          className="text-white font-bold py-1 px-2 bg-blue-500 border-b-4 rounded flex items-center gap-2 border-blue-700 hover:border-blue-500 hover:bg-blue-400 active:transform active:translate-y-px active:border-b my-2"
          onClick={() => {
            // ctrl.toggleTrainingSettings();
            // onClose();
            setShowTrainingSettings(false);
          }}
        >
          <div id="return">
            <ArrowBigLeftDash></ArrowBigLeftDash>
          </div>
          <span>Back to Training</span>
        </button>

        <Divider label="Spaced Repetition" />

        <ToggleGroup
          label="Get next by"
          labels={['Breadth', 'Depth']}
          onClickHandlers={[
            // () => ctrl.setSrsConfig({ getNext: { by: 'breadth' } }),
            // () => ctrl.setSrsConfig({ getNext: { by: 'depth' } }),
          ]}
        />

        <ToggleGroup label="Promotion" labels={['Next', 'Most']} />
        <ToggleGroup label="Demotion" labels={['Next', 'Most']} />

        <Divider label="Display" />

        <ToggleGroup
          label="Piece animation"
          labels={['None', 'Slow', 'Normal', 'Fast']}
          onClickHandlers={[
            // () => ctrl.chessground!.set({ animation: { duration: 0 } }),
            // () => ctrl.chessground!.set({ animation: { enabled: true, duration: 500 } }),
            // () => ctrl.chessground!.set({ animation: { enabled: true, duration: 250 } }),
            // () => ctrl.chessground!.set({ animation: { enabled: true, duration: 120 } }),
          ]}
        />

        <ToggleGroup
          label="Coordinates"
          labels={['None', 'Outside', 'Each square']}
          onClickHandlers={[
            () => {
              // ctrl.chessground!.set({ coordinates: false });
              // ctrl.chessground?.redrawAll();
            },
            () => {
              // ctrl.chessground!.set({
              //   coordinates: true,
              //   coordinatesOnSquares: false,
              // });
              // ctrl.chessground?.redrawAll();
            },
            () => {
              // ctrl.chessground!.set({ coordinatesOnSquares: true });
              // ctrl.chessground?.redrawAll();
            },
          ]}
        />

        <div className="my-4">
          <label htmlFor="quantity" className="block text-lg font-bold">
            Quantity
          </label>
          <input
            id="quantity"
            className="bg-gray-400 text-white border border-gray-600 rounded-md px-2 py-1 w-20 text-center"
            type="number"
            name="quantity"
            min={1}
            max={30}
            // defaultValue={ctrl.srsConfig.getNext?.max! / 2}
            defaultValue={1}
            onInput={(e) => {
              const quantity = parseInt((e.target as HTMLInputElement).value);
              // ctrl.srsConfig.getNext!.max = quantity * 2;
            }}
          />
        </div>

        <input
          type="submit"
          value="Submit"
          className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1 rounded-md mt-4"
        />
      </div>
    </div>
  );
};

const Divider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center my-4">
    <div className="flex-grow border-t border-gray-400" />
    <div className="mx-4 text-lg font-bold text-center font-mono text-gray-400">{label}</div>
    <div className="flex-grow border-t border-gray-400" />
  </div>
);

interface ToggleGroupProps {
  label: string;
  labels: string[];
  onClickHandlers?: (() => void)[];
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({ label, labels, onClickHandlers = [] }) => {
  return (
    <div className="p-2">
      <label className="block text-lg font-bold mb-1">{label}</label>
      <label className="inline-flex items-center rounded-md cursor-pointer text-gray-100 w-full">
        <input type="checkbox" className="hidden peer" />
        {labels.map((text, i) => (
          <span
            key={i}
            className={`px-4 ${
              i === 0 ? 'rounded-l-md' : i === labels.length - 1 ? 'rounded-r-md' : 'border-white border-x-2'
            } bg-blue-300 peer-checked:bg-blue-700 flex-1 p-1 text-center`}
            onClick={onClickHandlers[i]}
          >
            {text}
          </span>
        ))}
      </label>
    </div>
  );
};

export default SettingsModal;
