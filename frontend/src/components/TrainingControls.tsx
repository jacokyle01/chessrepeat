import React, { Dispatch, SetStateAction, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Book,
  FilePenLineIcon,
  FolderCog2,
  GraduationCap,
  GraduationCapIcon,
  History,
  Lightbulb,
  Repeat2,
  Settings,
  Settings2,
  SquarePen,
} from 'lucide-react';
import { EXAMPLE_CHAPTER_NAME, useTrainerStore } from '../store/state';
import './TrainingControls.css';
// import SettingsButton from './SettingsButton';
// import { bookI, recallI, gearI } from './Icons'; // Update the path if necessary

// export interface ControlsProps {
//   handleLearn: () => void;
//   handleRecall: () => void;
//   handleEdit: () => void;
// }

const Controls = () => {
  const setTrainingMethod = useTrainerStore((s) => s.setTrainingMethod);
  // Subscribed, not read off getState(): getState() returns whatever the store
  // holds at render time without registering a dependency, so this component
  // only saw a mode change if some *other* subscription happened to re-render
  // it first — which is exactly the window the Learn nudge lives in.
  const method = useTrainerStore((s) => s.trainingMethod);
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const updateDueCounts = useTrainerStore((s) => s.updateDueCounts);

  const repertoire = useTrainerStore((s) => s.repertoire);
  const selectedChapterId = useTrainerStore((s) => s.selectedChapterId);
  const name = repertoire.find((c) => c.uuid === selectedChapterId)?.name || '';

  // Nudge new users toward their first review: when the seeded example
  // chapter is selected but no training mode is active yet, make Learn pop.
  // Compared loosely — the name survives an IDB round trip and a server fetch,
  // and an exact match would silently drop the nudge over a stray space.
  const promptExample =
    !method && name.trim().toLowerCase() === EXAMPLE_CHAPTER_NAME.toLowerCase();

  // The raised chip behind the active pill is positioned from the active
  // button's own box, so it slides (and resizes) between modes. The buttons
  // scale with the board via container queries, hence the ResizeObserver.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const [chip, setChip] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    const measure = () => {
      const btn = activeRef.current;
      if (!btn) return setChip(null);
      setChip({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
      });
    };
    measure();
    if (!track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [method]);

  //TODO difference between handleLearn and setting mode to learn?
  return (
    <div className="training-controls-wrap">
      <div id="training-controls" className="control-tab" ref={trackRef}>
        {/* EDIT */}
        <button
          ref={method === 'edit' ? activeRef : undefined}
          onClick={() => setTrainingMethod('edit')}
          className={`control-tab-btn training-btn training-btn-edit ${
            method === 'edit' ? 'is-active' : ''
          }`}
        >
          <SquarePen size={18} />
          Edit
        </button>

        {/* LEARN */}
        <button
          ref={method === 'learn' ? activeRef : undefined}
          onClick={() => {
            setTrainingMethod('learn');
            setNextTrainable();
            updateDueCounts();
          }}
          className={`control-tab-btn training-btn training-btn-learn ${
            method === 'learn' ? 'is-active' : promptExample ? 'is-prompted' : ''
          }`}
        >
          <GraduationCap size={18} />
          Learn
        </button>

        {/* RECALL */}
        <button
          ref={method === 'recall' ? activeRef : undefined}
          onClick={() => {
            setTrainingMethod('recall');
            setNextTrainable();
            updateDueCounts();
          }}
          className={`control-tab-btn training-btn training-btn-recall ${
            method === 'recall' ? 'is-active' : ''
          }`}
        >
          <History size={18} />
          Recall
        </button>

        <div
          className="control-tab-chip"
          role="presentation"
          data-rendered={chip ? 'true' : 'false'}
          style={
            chip
              ? ({
                  '--active-tab-left': `${chip.left}px`,
                  '--active-tab-top': `${chip.top}px`,
                  '--active-tab-width': `${chip.width}px`,
                  '--active-tab-height': `${chip.height}px`,
                } as React.CSSProperties)
              : undefined
          }
        />
      </div>
    </div>
  );
};

export default Controls;
