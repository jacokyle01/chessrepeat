import React from 'react';
import { CircleXIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import Divider from '../common/Divider';
import ToggleGroup from '../common/ToggleGroup';

const SettingsModal: React.FC = (setSettingsOpen: (b: boolean) => void) => {
  const trainingConfig = useTrainerStore((s) => s.trainingConfig);
  const setTrainingConfig = useTrainerStore((s) => s.setTrainingConfig);

  // Helper: immutable update by "a.b.c" path
  const updateConfig = (path: string, value: any) => {
    const copy: any = { ...trainingConfig };
    const keys = path.split('.');
    let cur: any = copy;

    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = { ...(cur[keys[i]] ?? {}) };
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;

    setTrainingConfig(copy);
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2
                 border-none !bg-white rounded-lg shadow-lg"
    >
      {/* Close button (matches your AddToRepertoireModal) */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8
                   flex items-center justify-center shadow-md hover:bg-red-600"
        aria-label="Close"
        onClick={() => setSettingsOpen(false)}
        type="button"
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      {/* Heading */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Training Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Configure spaced repetition and display preferences.</p>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Spaced Repetition */}
        <Divider label="Spaced Repetition" />

        <ToggleGroup
          label="Get next by"
          labels={['Breadth', 'Depth']}
          selected={trainingConfig.getNext?.by === 'breadth' ? 'Breadth' : 'Depth'}
          onChange={(val) => updateConfig('getNext.by', val.toLowerCase())}
        />

        <div className="mt-4">
          <label className="block text-gray-700 text-base font-semibold mb-2">Max moves to consider</label>
          <input
            type="number"
            min={1}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight
                       focus:outline-none focus:shadow-outline"
            value={trainingConfig.getNext?.max ?? ''}
            onChange={(e) => updateConfig('getNext.max', Number(e.target.value))}
          />
        </div>

        <div className="mt-4">
          <ToggleGroup
            label="Promotion"
            labels={['Next', 'Most']}
            selected={trainingConfig.promotion === 'next' ? 'Next' : 'Most'}
            onChange={(val) => updateConfig('promotion', val.toLowerCase())}
          />
        </div>

        <div className="mt-4">
          <ToggleGroup
            label="Demotion"
            labels={['Next', 'Most']}
            selected={trainingConfig.demotion === 'next' ? 'Next' : 'Most'}
            onChange={(val) => updateConfig('demotion', val.toLowerCase())}
          />
        </div>

        {/* Display */}
        <div className="mt-6">
          <Divider label="Display" />
          <ToggleGroup
            label="Animation"
            labels={['None', 'Slow']}
            selected="None"
            onChange={(val) => console.log('Animation changed to', val)}
          />
        </div>

        {/* Footer / Done */}
        <button
          type="button"
          onClick={() => setShowingTrainingSettings(false)}
          className="mt-6 w-full text-lg font-bold py-2 px-4 rounded
                     bg-green-600 hover:bg-green-700 text-white
                     focus:outline-none focus:shadow-outline transition"
        >
          Done
        </button>
      </div>
    </dialog>
  );
};

export default SettingsModal;
