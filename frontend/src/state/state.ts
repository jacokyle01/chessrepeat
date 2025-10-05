// state/trainerStore.ts
//TODO prefix treepath functions with treePath.___
import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

import { RepertoireChapter } from '../types/types';
import { RepertoireMethod, TrainableContext } from '../spaced-repetition/types';
import { Config as SrsConfig, defaults } from '../spaced-repetition/config';
import { Config as CbConfig } from 'chessground/config';

// import { path as treePath} from '../components/tree/tree';
import { deleteNodeAt, getNodeList, last, nodeAtPath } from '../components/tree/ops';
//TODO make sure we are using this convention to import
import { path as treePath } from '../components/tree/ops';

interface TrainerState {
  repertoireMethod: RepertoireMethod;
  setRepertoireMethod: (m: RepertoireMethod) => void;

  showTrainingSettings: boolean;
  setShowTrainingSettings: (val: boolean) => void;

  showingAddToRepertoireMenu: boolean;
  setShowingAddToRepertoireMenu: (val: boolean) => void;

  repertoire: RepertoireChapter[];
  setRepertoire: (r: RepertoireChapter[]) => void;

  numWhiteEntries: number;
  setNumWhiteEntries: (n: number) => void;

  repertoireIndex: number;
  setRepertoireIndex: (i: number) => void;

  trainableContext: TrainableContext | undefined;
  setTrainableContext: (t: TrainableContext) => void;

  selectedPath: string;
  setSelectedPath: (p: string) => void;

  selectedNode: any;
  setSelectedNode: (n: any) => void;

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

  srsConfig: SrsConfig;
  setSrsConfig: (cfg: SrsConfig) => void;

  cbConfig: CbConfig;
  setCbConfig: (cfg: CbConfig) => void;

  jump: (path: string) => void;
  deleteNode: (path: string) => void;
  clearChapterContext: () => void;
}

// --- IndexedDB storage for zustand ---
const indexedDBStorage: StateStorage = {
  getItem: async (name) => {
    const value = await get(name);
    return value ?? null; // already a string
  },
  setItem: async (name, value) => {
    await set(name, value); // keep as string
  },
  removeItem: async (name) => {
    await del(name);
  },
};

// --- create store with persist ---
export const useTrainerStore = create<TrainerState>()(
  persist(
    (set, get) => ({
      repertoireMethod: 'unselected',
      setRepertoireMethod: (repertoireMethod) => set({ repertoireMethod }),

      showTrainingSettings: false,
      setShowTrainingSettings: (val) => set({ showTrainingSettings: val }),

      showingAddToRepertoireMenu: false,
      setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

      repertoire: [],
      setRepertoire: (repertoire) => set({ repertoire }),

      numWhiteEntries: 0,
      setNumWhiteEntries: (n) => set({ numWhiteEntries: n }),

      repertoireIndex: 0,
      setRepertoireIndex: (i) => set({ repertoireIndex: i }),

      trainableContext: undefined,
      setTrainableContext: (t) => set({ trainableContext: t }),

      selectedPath: '',
      setSelectedPath: (path) => set({ selectedPath: path }),

      selectedNode: null,
      setSelectedNode: (node) => set({ selectedNode: node }),

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

      srsConfig: defaults(),
      setSrsConfig: (cfg) => set({ srsConfig: cfg }),

      cbConfig: {},
      setCbConfig: (cfg) => set({ cbConfig: cfg }),

      jump: (path) => {
        const { repertoire, repertoireIndex } = get();
        const root = repertoire[repertoireIndex].tree;
        if (!root) return;
        const nodeList = getNodeList(root, path);
        const node = nodeList.at(-1);
        set({ selectedPath: path, selectedNode: node });
      },

      deleteNode: (path) => {
        const { repertoire, repertoireIndex, selectedPath, jump } = get();
        const tree = repertoire[repertoireIndex]?.tree;
        if (!tree) return;
        const node = nodeAtPath(tree, path);
        if (!node) return;

        deleteNodeAt(tree, path);

        if (treePath.contains(selectedPath, path)) {
          jump(treePath.init(path));
        } else {
          jump(path);
        }
      },

      clearChapterContext: () => {
        set({
          repertoireMethod: 'unselected',
          selectedPath: '',
          lastFeedback: 'empty',
          cbConfig: {
            lastMove: null,
            drawable: {
              shapes: []
            }
          },
          selectedNode: null,
        });
      },
    }),
    {
      name: 'trainer-store', // IndexedDB key
      storage: indexedDBStorage,
      partialize: (state) => ({
        // only persist long-term data
        repertoire: state.repertoire,
        numWhiteEntries: state.numWhiteEntries,
        repertoireIndex: state.repertoireIndex,
        srsConfig: state.srsConfig,
      }),
    },
  ),
);