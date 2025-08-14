import { useTrainerStore } from '../state/state';
import Divider from './common/Divider';
import ToggleGroup from './common/ToggleGroup';
import { useState } from 'react';

// export interface Config {
//   getNext?: {
//     by?: 'depth' | 'breadth';
//     max?: number;
//   };
//   promotion?: 'most' | 'next';
//   demotion?: 'most' | 'next';
// }

const SettingsPopover: React.FC = () => {
  const setShowTrainingSettings = useTrainerStore((s) => s.setShowTrainingSettings);
  const srsConfig = useTrainerStore().srsConfig;
  const setSrsConfig = useTrainerStore((c) => c.setSrsConfig);

  // const [config, setConfig] = useState<Config>({
  //   getNext: { by: 'breadth', max: 10 },
  //   promotion: 'next',
  //   demotion: 'most',
  // });

  //TODO do we need this helper func ?
  const updateConfig = (path: string, value: any) => {
    const copy = { ...srsConfig };
    const keys = path.split('.');
    let cur: any = copy;
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = { ...cur[keys[i]] };
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    setSrsConfig(copy);
  };

  return (
    <div className="bg-white w-80 max-w-lg rounded-xl shadow-2xl border border-gray-200 p-6 relative">
      {/* Close button */}
      <button
        onClick={() => setShowTrainingSettings(false)}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        ✕
      </button>

      {/* Spaced Repetition */}
      <Divider label="Spaced Repetition" />
      <ToggleGroup
        label="Get next by"
        labels={['Breadth', 'Depth']}
        selected={srsConfig.getNext?.by === 'breadth' ? 'Breadth' : 'Depth'}
        onChange={(val) => updateConfig('getNext.by', val.toLowerCase())}
      />
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Max moves to consider</label>
        <input
          type="number"
          min={1}
          className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          value={srsConfig.getNext?.max ?? ''}
          onChange={(e) => updateConfig('getNext.max', Number(e.target.value))}
        />
      </div>

      <ToggleGroup
        label="Promotion"
        labels={['Next', 'Most']}
        selected={srsConfig.promotion === 'next' ? 'Next' : 'Most'}
        onChange={(val) => updateConfig('promotion', val.toLowerCase())}
      />
      <ToggleGroup
        label="Demotion"
        labels={['Next', 'Most']}
        selected={srsConfig.demotion === 'next' ? 'Next' : 'Most'}
        onChange={(val) => updateConfig('demotion', val.toLowerCase())}
      />

      {/* Display */}
      <Divider label="Display" />
      <ToggleGroup
        label="Animation"
        labels={['None', 'Slow']}
        selected="None" // could wire up to config if you add an animation setting
        onChange={(val) => console.log('Animation changed to', val)}
      />

      {/* Save button */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => {
            // Save config to store here
            console.log('Saving config:', srsConfig);
            setShowTrainingSettings(false);
          }}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default SettingsPopover;
