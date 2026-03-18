import React, { useState } from 'react';
import { CircleXIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import Divider from '../common/Divider';
import ToggleGroup from '../common/ToggleGroup';
import { NodeSearch } from '../../types/training';
import './SettingsModal.css';

const SettingsModal: React.FC<{ setSettingsOpen: (b: boolean) => void }> = ({ setSettingsOpen }) => {
  const searchConfig = useTrainerStore((s) => s.searchConfig);
  const setSearchConfig = useTrainerStore((s) => s.setSearchConfig);

  const [draft, setDraft] = useState<NodeSearch>({ ...searchConfig });
  const isDirty = draft.algorithm !== searchConfig.algorithm || draft.limit !== searchConfig.limit;

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
        <ToggleGroup
          label="Get next by"
          labels={['Breadth', 'Depth']}
          selected={draft.algorithm === 'bfs' ? 'Breadth' : 'Depth'}
          onChange={(val) => setDraft({ ...draft, algorithm: val === 'Breadth' ? 'bfs' : 'dfs' })}
        />

        <div className="settings-field">
          <label>Max moves to consider</label>
          <div className="flex items-center gap-1">
            <button
              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-sm font-medium hover:bg-gray-100"
              onClick={() => setDraft({ ...draft, limit: Math.max(1, draft.limit - 1) })}
            >
              -
            </button>
            <span className="min-w-[2rem] text-center text-sm font-medium">
              {draft.limit}
            </span>
            <button
              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-sm font-medium hover:bg-gray-100"
              onClick={() => setDraft({ ...draft, limit: draft.limit + 1 })}
            >
              +
            </button>
          </div>
        </div>

        <div className="relative h-6">
          <span
            className={`absolute inset-0 flex items-center justify-center text-xs text-amber-600 transition-opacity duration-150 ${isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            Unsaved changes
          </span>
        </div>

        <button
          type="button"
          className="settings-done-btn"
          onClick={() => {
            if (isDirty) setSearchConfig(draft);
            setSettingsOpen(false);
          }}
        >
          Save
        </button>
      </div>
    </dialog>
  );
};

export default SettingsModal;
