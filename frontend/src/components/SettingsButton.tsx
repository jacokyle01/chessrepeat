import { Settings, Settings2 } from 'lucide-react';
import { useTrainerStore } from '../state/state';
import SettingsPopover from './SettingsPopover';

const SettingsButton = () => {
  const showTrainingSettings = useTrainerStore((s) => s.showTrainingSettings);
  const setShowTrainingSettings = useTrainerStore((s) => s.setShowTrainingSettings);

  const backgroundColor = showTrainingSettings ? 'bg-blue-300' : 'bg-gray-300';

  return (
    <div className="relative inline-block text-left">
      {/* Popover ABOVE the icon */}
      {showTrainingSettings && (
        <>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50">
            <SettingsPopover />
          </div>

          {/* Bridge from popover down to icon */}
          {/* <div className="absolute  bottom-[calc(100%-4px)] left-1/2 -translate-x-1/2 w-[2px] h-2 bg-white z-40 shadow-sm" /> */}
        </>
        
      )}

      {/* Settings Icon */}
      <div
        className={`cursor-pointer p-2 rounded-l text-gray-900 bg-gray-200 border border-gray-700`}
        onClick={() => setShowTrainingSettings(!showTrainingSettings)}
      >
        <Settings className="w-7 h-7" />
      </div>
    </div>
  );
};

export default SettingsButton;
