// state/trainerStore.ts
import { create } from 'zustand';
import { RepertoireChapter, RepertoireEntry, RepertoireMode } from '../types/types';
import { Method, TrainingPath } from '../spaced-repetition/types';
import { Config as SrsConfig, defaults } from '../spaced-repetition/config';
import { Config as CbConfig } from 'chessground/config';

interface TrainerState {
  // UI
  repertoireMode: RepertoireMode;
  setRepertoireMode: (r: RepertoireMode) => void;

  trainingMethod: Method;
  setTrainingMethod: (m: Method) => void;

  showTrainingSettings: boolean;
  setShowTrainingSettings: (val: boolean) => void;

  showingAddToRepertoireMenu: boolean;
  setShowingAddToRepertoireMenu: (val: boolean) => void;

  // Repertoire
  repertoire: RepertoireChapter[];
  setRepertoire: (r: RepertoireChapter[]) => void;

  numWhiteEntries: number;
  setNumWhiteEntries: (n: number) => void;

  repertoireIndex: number;
  setRepertoireIndex: (i: number) => void;

  // Training
  trainingPath: TrainingPath;
  setTrainingPath: (p: TrainingPath) => void;

  pathIndex: number;
  setPathIndex: (i: number) => void;  

  showingHint: boolean;
  setShowingHint: (v: boolean) => void;

  lastFeedback: string;
  setLastFeedback: (f: string) => void;

  lastResult: string;
  setLastResult: (r: string) => void;

  lastGuess: string;
  setLastGuess: (g: string) => void;

  showSuccessfulGuess: boolean;
  setShowSuccessfulGuess: (val: boolean) => void;

  dueTimes: number[];
  setDueTimes: (t: number[]) => void;

  // Config
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;

  srsConfig: SrsConfig;
  setSrsConfig: (cfg: SrsConfig) => void;

  cbConfig: CbConfig;
  setCbConfig: (cfg: CbConfig) => void;
}

export const useTrainerStore = create<TrainerState>((set) => ({
  // UI
  repertoireMode: 'train',
  setRepertoireMode: (repertoireMode) => set({ repertoireMode }),

  trainingMethod: 'unselected',
  setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

  showTrainingSettings: false,
  setShowTrainingSettings: (val) => set({ showTrainingSettings: val }),

  showingAddToRepertoireMenu: false,
  setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

  // Repertoire
  repertoire: [],
  setRepertoire: (repertoire) => set({ repertoire }),

  numWhiteEntries: 0,
  setNumWhiteEntries: (n) => set({ numWhiteEntries: n }),

  repertoireIndex: -1,
  setRepertoireIndex: (i) => set({ repertoireIndex: i }),

  // Training
  trainingPath: [],
  setTrainingPath: (path) => set({ trainingPath: path }),

  pathIndex: -1,
  setPathIndex: (i) => set({ pathIndex: i }),



  showingHint: false,
  setShowingHint: (v) => set({ showingHint: v }),

  lastFeedback: 'init',
  setLastFeedback: (f) => set({ lastFeedback: f }),

  lastResult: 'none',
  setLastResult: (r) => set({ lastResult: r }),

  lastGuess: '',
  setLastGuess: (g) => set({ lastGuess: g }),

  showSuccessfulGuess: false,
  setShowSuccessfulGuess: (val) => set({ showSuccessfulGuess: val }),

  dueTimes: [],
  setDueTimes: (t) => set({ dueTimes: t }),

  // Config
  orientation: 'white',
  setOrientation: (o) => set({ orientation: o }),

  srsConfig: defaults(),
  setSrsConfig: (cfg) => set({ srsConfig: cfg }),

  cbConfig: {},
  setCbConfig: (cfg) => set({ cbConfig: cfg }),
}));
