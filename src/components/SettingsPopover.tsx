import { useTrainerStore } from '../state/state';
import Divider from './common/Divider';
import ToggleGroup from './common/ToggleGroup';

const SettingsPopover: React.FC = () => {
  const setShowTrainingSettings = useTrainerStore((s) => s.setShowTrainingSettings);

  return (
    <div className="bg-white w-64 rounded-lg shadow-xl border p-4 relative">
      <Divider label="Spaced Repetition" />
      <ToggleGroup label="Get next by" labels={['Breadth', 'Depth']} />
      <ToggleGroup label="Promotion" labels={['Next', 'Most']} />
      <ToggleGroup label="Demotion" labels={['Next', 'Most']} />

      <Divider label="Display" />
      <ToggleGroup label="Animation" labels={['None', 'Slow']} />
    </div>
  );
};

export default SettingsPopover;
