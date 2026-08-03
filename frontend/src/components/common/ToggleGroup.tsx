

import React, { useState } from 'react';
import './ToggleGroup.css';

interface ToggleGroupProps {
  label: string;
  labels: string[];
  selected?: string; // which label is selected (controlled mode)
  onChange?: (label: string) => void; // fired when selection changes
  onClickHandlers?: (() => void)[];
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({
  label,
  labels,
  selected,
  onChange,
  onClickHandlers = [],
}) => {
  // Only use internal state if "selected" is not provided
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isControlled = selected !== undefined;
  const currentIndex = isControlled
    ? labels.findIndex((l) => l.toLowerCase() === selected.toLowerCase())
    : activeIndex;

  return (
    <div className="toggle-group">
      <label className="toggle-group-label">{label}</label>
      <div className="toggle-group-options">
        {labels.map((text, i) => (
          <button
            key={i}
            className={`toggle-group-option ${currentIndex === i ? 'is-selected' : ''}`}
            onClick={() => {
              if (!isControlled) {
                setActiveIndex(i);
              }
              onChange?.(text);
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
