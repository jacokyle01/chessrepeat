// state/trainerStore.ts
import { create } from 'zustand';
import { RepertoireChapter, RepertoireEntry, RepertoireMode } from '../types/types';
import { RepertoireMethod, TrainableContext } from '../spaced-repetition/types';
import { Config as SrsConfig, defaults } from '../spaced-repetition/config';
import { Config as CbConfig } from 'chessground/config';

import {
  build as makeTree,
  path as treePath,
  ops as treeOps,
  type TreeWrapper,
} from '../components/tree/tree';

interface TrainerState {
  // UI
  // repertoireMode: RepertoireMode;
  // setRepertoireMode: (r: RepertoireMode) => void;

  // trainingMethod: Method;
  // setTrainingMethod: (m: Method) => void;

  repertoireMethod: 'edit' | 'recall' | 'learn' | 'unselected';
  setRepertoireMethod: (m: RepertoireMethod) => void;

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

  // // Training //TODO do we need both?
  // trainingNodeList: Tree.Node[];
  // setTrainingNodeList: (p: Tree.Node[]) => void;

  // trainingPath: Tree.Path;
  // setTrainingPath: (p: Tree.Path) => void;

  /*
  Context relevant to describe a trainable position- 
  the path to the position and the node itself 
  */
  trainableContext: TrainableContext | undefined;
  setTrainableContext: (t: TrainableContext) => void;

  // Path to currently selected node
  selectedPath: Tree.Path;
  setSelectedPath: (p: string) => void;

  // current selected node
  selectedNode: Tree.Node;
  setSelectedNode: (n: Tree.Node) => void;

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

  // functions

  jump: (path: Tree.Path) => void;
  deleteNode: (path: Tree.Path) => void;

  clearChapterContext: () => void;
}

export const useTrainerStore = create<TrainerState>((set, get) => ({
  // UI
  // repertoireMode: 'train',
  // setRepertoireMode: (repertoireMode) => set({ repertoireMode }),

  // trainingMethod: 'unselected',
  // setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

  repertoireMethod: 'unselected',
  setRepertoireMethod: (repertoireMethod) => set({ repertoireMethod }),

  showTrainingSettings: false,
  setShowTrainingSettings: (val) => set({ showTrainingSettings: val }),

  showingAddToRepertoireMenu: false,
  setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

  // Repertoire
  repertoire: [],
  setRepertoire: (repertoire) => set({ repertoire }),

  numWhiteEntries: 0,
  setNumWhiteEntries: (n) => set({ numWhiteEntries: n }),

  repertoireIndex: 0,
  setRepertoireIndex: (i) => set({ repertoireIndex: i }),

  // // Training
  // trainingNodeList: [],
  // setTrainingNodeList: (path) => set({ trainingNodeList: path }),

  // trainingPath: '',
  // setTrainingPath: (path) => set({trainingPath: path}),

  trainableContext: undefined,
  setTrainableContext: (t) => set({ trainableContext: t }),

  selectedPath: '',
  setSelectedPath: (path) => set({ selectedPath: path }),

  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node }),

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

  // functions
  jump: (path) => {
    const { repertoire, repertoireIndex } = get();
    const tree = repertoire[repertoireIndex].tree;

    const nodeList = tree.getNodeList(path);
    const node = treeOps.last(nodeList);

    set({
      selectedPath: path,
      selectedNode: node,
    });
  },

  deleteNode: (path) => {
    const { repertoire, repertoireIndex, selectedPath, jump } = get();
    const tree = repertoire[repertoireIndex].tree;
    const node = tree.nodeAtPath(path);

    if (!node) return;

    // TODO: count nodes to determine deeper removals if needed
    // const count = treeOps.countChildrenAndComments(node);

    tree.deleteNodeAt(path);

    if (treePath.contains(selectedPath, path)) {
      jump(treePath.init(path));
    } else {
      jump(path);
    }

    // TODO: study.deleteNode(path), redraw, etc. if you have those in your state
  },

  clearChapterContext: () => {
    const { repertoire, repertoireIndex, setRepertoireMethod, setSelectedPath, setLastFeedback } = get();
    setRepertoireMethod('unselected');
    setSelectedPath('');
    setLastFeedback('empty');
  },
}));
