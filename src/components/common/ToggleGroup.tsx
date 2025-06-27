import React, { useState } from 'react';

interface ToggleGroupProps {
  label: string;
  labels: string[];
  onClickHandlers?: (() => void)[];
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({ label, labels, onClickHandlers = [] }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-1">{label}</label>
      <div className="flex rounded overflow-hidden border border-gray-300">
        {labels.map((text, i) => (
          <button
            key={i}
            className={`flex-1 px-3 py-1 text-sm font-medium transition ${
              i === 0 ? 'rounded-l' : i === labels.length - 1 ? 'rounded-r' : ''
            } ${
              activeIndex === i
                ? 'bg-blue-500 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            }`}
            onClick={() => {
              setActiveIndex(i);
              onClickHandlers[i]?.();
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToggleGroup;
