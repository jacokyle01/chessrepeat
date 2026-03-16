import React from 'react';
import { CircleXIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import Divider from '../common/Divider';
import ToggleGroup from '../common/ToggleGroup';
import './SettingsModal.css';

const SettingsModal: React.FC<{ setSettingsOpen: (b: boolean) => void }> = ({ setSettingsOpen }) => {
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
    <dialog open className="settings-dialog">
      <button
        className="settings-close-btn"
        aria-label="Close"
        onClick={() => setSettingsOpen(false)}
        type="button"
      >
        <CircleXIcon style={{ width: '1.25rem', height: '1.25rem' }} />
      </button>

      <div className="settings-header">
        <h2>Training Settings</h2>
        <p>Configure spaced repetition and display preferences.</p>
      </div>

      <div className="settings-body">
        <Divider label="Spaced Repetition" />

        <ToggleGroup
          label="Get next by"
          labels={['Breadth', 'Depth']}
          selected={trainingConfig.getNext?.by === 'breadth' ? 'Breadth' : 'Depth'}
          onChange={(val) => updateConfig('getNext.by', val.toLowerCase())}
        />

        <div className="settings-field">
          <label>Max moves to consider</label>
          <input
            type="number"
            min={1}
            value={trainingConfig.getNext?.max ?? ''}
            onChange={(e) => updateConfig('getNext.max', Number(e.target.value))}
          />
        </div>

        <ToggleGroup
          label="Promotion"
          labels={['Next', 'Most']}
          selected={trainingConfig.promotion === 'next' ? 'Next' : 'Most'}
          onChange={(val) => updateConfig('promotion', val.toLowerCase())}
        />

        <ToggleGroup
          label="Demotion"
          labels={['Next', 'Most']}
          selected={trainingConfig.demotion === 'next' ? 'Next' : 'Most'}
          onChange={(val) => updateConfig('demotion', val.toLowerCase())}
        />

        <Divider label="Display" />
        <ToggleGroup
          label="Animation"
          labels={['None', 'Slow']}
          selected="None"
          onChange={(val) => console.log('Animation changed to', val)}
        />

        <button
          type="button"
          className="settings-done-btn"
          onClick={() => setSettingsOpen(false)}
        >
          Done
        </button>
      </div>
    </dialog>
  );
};

export default SettingsModal;
