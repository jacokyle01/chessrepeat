import React, { useState } from 'react';
import { CircleXIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import Divider from '../common/Divider';
import ToggleGroup from '../common/ToggleGroup';
import { NodeSearch } from '../../types/training';
import { SrsConfig, defaultSrsConfig } from '../../util/srs';
import './SettingsModal.css';

const SettingsModal: React.FC<{ setSettingsOpen: (b: boolean) => void }> = ({ setSettingsOpen }) => {
  const searchConfig = useTrainerStore((s) => s.searchConfig);
  const setSearchConfig = useTrainerStore((s) => s.setSearchConfig);
  const srsConfig = useTrainerStore((s) => s.srsConfig);
  const setSrsConfig = useTrainerStore((s) => s.setSrsConfig);

  const [draft, setDraft] = useState<NodeSearch>({ ...searchConfig });
  const [srsDraft, setSrsDraft] = useState<SrsConfig>({ ...srsConfig });

  const isSearchDirty = draft.algorithm !== searchConfig.algorithm || draft.limit !== searchConfig.limit;
  const isSrsDirty =
    srsDraft.request_retention !== srsConfig.request_retention ||
    srsDraft.maximum_interval !== srsConfig.maximum_interval ||
    srsDraft.enable_fuzz !== srsConfig.enable_fuzz ||
    srsDraft.enable_short_term !== srsConfig.enable_short_term;
  const isDirty = isSearchDirty || isSrsDirty;

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

        <Divider label="FSRS" />

        <div className="settings-field">
          <label>Target recall ({Math.round(srsDraft.request_retention * 100)}%)</label>
          <input
            type="range"
            min={0.7}
            max={0.99}
            step={0.01}
            value={srsDraft.request_retention}
            onChange={(e) => setSrsDraft({ ...srsDraft, request_retention: parseFloat(e.target.value) })}
          />
        </div>

        <div className="settings-field">
          <label>Maximum interval (days)</label>
          <input
            type="number"
            min={1}
            max={36500}
            value={srsDraft.maximum_interval}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1) {
                setSrsDraft({ ...srsDraft, maximum_interval: Math.min(val, 36500) });
              }
            }}
          />
        </div>

        <ToggleGroup
          label="Fuzz intervals"
          labels={['Off', 'On']}
          selected={srsDraft.enable_fuzz ? 'On' : 'Off'}
          onChange={(val) => setSrsDraft({ ...srsDraft, enable_fuzz: val === 'On' })}
        />

        <ToggleGroup
          label="Short-term learning steps"
          labels={['Off', 'On']}
          selected={srsDraft.enable_short_term ? 'On' : 'Off'}
          onChange={(val) => setSrsDraft({ ...srsDraft, enable_short_term: val === 'On' })}
        />

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
            if (isSearchDirty) setSearchConfig(draft);
            if (isSrsDirty) setSrsConfig(srsDraft);
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
