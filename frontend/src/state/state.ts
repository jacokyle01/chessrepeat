// state/trainerStore.ts
//TODO prefix treepath functions with treePath.___
import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { produce } from 'immer';

import {
  TrainingMethod,
  TrainableContext,
  TrainingOutcome,
  Chapter,
  TrainingData,
  TrainingConfig,
  Color,
  TrainableNode,
} from '../training/types';
import { Config as CbConfig } from 'chessground/config';

// import { path as treePath} from '../components/tree/tree';
//TODO make sure we are using this convention to import
import { ChildNode } from 'chessops/pgn';
import { computeDueCounts, computeNextTrainableNode, computeSucceedUpdate } from '../training/ops';
import { colorFromPly, currentTime, positionFromFen } from '../util';
import { defaults } from '../training/config';
import { deleteNodeAt, getNodeList, nodeAtPath, updateRecursive } from '../tree/ops';
import { chapterFromPgn, rootFromPgn } from '../io/util';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { merge } from '../training/util';
import { contains, init } from '../tree/path';

interface TrainerState {
  /* UI Flags */
  trainingMethod: TrainingMethod;
  setTrainingMethod: (m: TrainingMethod) => void;

  showingTrainingSettings: boolean;
  setShowingTrainingSettings: (val: boolean) => void;

  showingAddToRepertoireMenu: boolean;
  setShowingAddToRepertoireMenu: (val: boolean) => void;

  showingImportIntoChapterModal: boolean;
  setShowingImportIntoChapterModal: (val: boolean) => void;

  repertoire: Chapter[];
  setRepertoire: (r: Chapter[]) => void;

  repertoireIndex: number;
  setRepertoireIndex: (i: number) => void;

  trainableContext: TrainableContext | undefined;
  setTrainableContext: (t: TrainableContext) => void;

  selectedPath: string;
  setSelectedPath: (p: string) => void;

  selectedNode: ChildNode<TrainingData>;
  setSelectedNode: (n: any) => void;

  showingHint: boolean;
  setShowingHint: (v: boolean) => void;

  userTip: string;
  setUserTip: (f: string) => void;

  lastGuess: string;
  setLastGuess: (g: string) => void;

  showSuccessfulGuess: boolean;
  setShowSuccessfulGuess: (val: boolean) => void;

  dueTimes: number[];
  setDueTimes: (t: number[]) => void;

  trainingConfig: TrainingConfig;
  setTrainingConfig: (config: TrainingConfig) => void;

  cbConfig: CbConfig;
  setCbConfig: (cfg: CbConfig) => void;

  jump: (path: string) => void;

  makeMove: (san: string) => void;

  clearChapterContext: () => void;
  //TODO annotate these correctly
  setCommentAt: (comment: string, path: string) => void;
  updateDueCounts: () => void;
  setNextTrainablePosition: () => void;
  succeed: () => number | null;
  fail: () => void;
  guess: (san: string) => TrainingOutcome;

  // higher-level ops
  markAllAsSeen: () => void;
  disableLine: (path: string) => void;
  deleteLine: (path: string) => void;
  enableLine: (path: string) => void;
  addNewChapter: (chapter: Chapter) => void;

  importIntoChapter: (targetChapter: number, newPgn: string) => void;
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
      trainingMethod: 'unselected',
      setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

      showingTrainingSettings: false,
      setShowingTrainingSettings: (val) => set({ showingTrainingSettings: val }),

      showingAddToRepertoireMenu: false,
      setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

      showingImportIntoChapterModal: false,
      setShowingImportIntoChapterModal: (val) => set({ showingAddToRepertoireMenu: val }),

      repertoire: [],
      setRepertoire: (repertoire) => set({ repertoire }),

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

      userTip: 'init',
      setUserTip: (f) => set({ userTip: f }),

      lastGuess: '',
      setLastGuess: (g) => set({ lastGuess: g }),

      showSuccessfulGuess: false,
      setShowSuccessfulGuess: (val) => set({ showSuccessfulGuess: val }),

      dueTimes: [],
      setDueTimes: (t) => set({ dueTimes: t }),

      trainingConfig: defaults(),
      setTrainingConfig: (cfg) => set({ trainingConfig: cfg }),

      cbConfig: {},
      setCbConfig: (cfg) => set({ cbConfig: cfg }),

      jump: (path) => {
        const { repertoire, repertoireIndex } = get();
        const root = repertoire[repertoireIndex].root;
        if (!root) return;
        const nodeList = getNodeList(root, path);
        const node = nodeList.at(-1);
        set({ selectedPath: path, selectedNode: node });
      },

      deleteLine: (path) => {
        const { repertoire, repertoireIndex, selectedPath, jump } = get();
        const root = repertoire[repertoireIndex]?.root;
        if (!root) return;
        const node = nodeAtPath(root, path);
        if (!node) return;

        deleteNodeAt(root, path);

        if (contains(selectedPath, path)) {
          jump(init(path));
        } else {
          jump(path);
          set({ repertoire });
        }
      },

      // state...
      setNextTrainablePosition: () => {
        const { trainingMethod: method, repertoireIndex, repertoire, trainingConfig } = get();
        if (repertoireIndex === -1 || method === 'edit') return null;
        const chapter = repertoire[repertoireIndex];
        console.log('repertoire in setNext...', repertoire);
        if (!chapter) return;
        const root = chapter.root;

        const maybeTrainingContext = computeNextTrainableNode(
          repertoire[repertoireIndex].root,
          method,
          trainingConfig!.getNext!,
        );
        console.log('computed context', maybeTrainingContext);
        if (!maybeTrainingContext) {
          set({ userTip: 'empty' });
          //TODO dont use trainableContext, just use selectedPath and selectedNode
          set({ selectedPath: '', selectedNode: null, trainableContext: null });
        } else {
          const targetPath = maybeTrainingContext.startingPath;
          const nodeList = getNodeList(root, targetPath);
          const targetNode = nodeList.at(-1);
          // TODO why are we storing trainable context separately
          set({ selectedPath: targetPath, selectedNode: targetNode, trainableContext: maybeTrainingContext });
          // also give feedback
          set({ userTip: method });
        }
      },

      updateDueCounts: () => {
        const { repertoire, repertoireIndex, trainingConfig } = get();
        if (repertoireIndex < 0) return;

        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;

        const counts = computeDueCounts(chapter.root, trainingConfig.buckets);

        // ✅ do all state writes inside set()
        set((state) => {
          // shallow copy chapter list if you want immutable updates
          //TODO use immer?
          const nextRepertoire = state.repertoire.slice();
          const nextChapter = { ...nextRepertoire[repertoireIndex] };

          nextChapter.lastDueCount = counts[0];
          nextRepertoire[repertoireIndex] = nextChapter;

          return {
            dueTimes: counts,
            repertoire: nextRepertoire,
          };
        });
      },

      clearChapterContext: () => {
        set({
          trainingMethod: 'unselected',
          selectedPath: '',
          userTip: 'empty',
          cbConfig: {
            lastMove: undefined,
            drawable: {
              shapes: [],
            },
          },
          selectedNode: null,
        });
      },

      //TODO do we need immer state actions?
      setCommentAt: (comment: string, path: string) => {
        set(
          produce((state) => {
            const chapter = state.repertoire[state.repertoireIndex];
            if (!chapter) return;

            const node = nodeAtPath(chapter.root, path);
            if (!node) return;

            node.data.comment = comment;
            // chapter.dirty = true; // optional
          }),
        );
      },

      // TODO refactor some of this into a utility function?
      succeed: (): number | null => {
        //TODO use immer produce?
        //TODO improve from basics
        const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig } = get();

        const targetNode = trainableContext.targetMove;
        const startingPath = trainableContext.startingPath;

        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;
        const root = chapter.root;

        // let node = TrainableNodeList?.at(-1);
        if (!targetNode) return;

        let timeToAdd = 0;
        switch (trainingMethod) {
          case 'recall':
            // not a number at runtime?
            let groupIndex = parseInt(targetNode.data.training.group + '');
            chapter.bucketEntries[groupIndex]--;
            switch (trainingConfig!.promotion) {
              case 'most':
                groupIndex = trainingConfig!.buckets!.length - 1;
                break;
              case 'next':
                groupIndex = Math.min(groupIndex + 1, trainingConfig!.buckets!.length - 1);
                break;
            }
            chapter.bucketEntries[groupIndex]++;
            timeToAdd = trainingConfig!.buckets![groupIndex];

            targetNode.data.training.group = groupIndex;
            break;
          case 'learn':
            // };
            // TODO use node.training instead?
            targetNode.data.training.seen = true;
            // node.dueAt = currentTime() + trainingConfig!.buckets![0];
            timeToAdd = trainingConfig!.buckets![0];
            targetNode.data.training.group = 0;
            chapter.bucketEntries[0]++; //globally, mark node as seen
            break;
        }

        targetNode.data.training.dueAt = currentTime() + timeToAdd;
        return timeToAdd;
        // const nowSec = currentTime();
        // let timeToAdd: number | null = null;

        // set(
        //   produce((state) => {
        //     const idx = state.repertoireIndex;
        //     if (idx < 0) return;

        //     const method = state.trainingMethod;
        //     if (method === 'edit') return;

        //     const chapter = state.repertoire[idx];
        //     if (!chapter) return;

        //     // const path = state.trainableContext.targetPath;
        //     const node = state.trainableContext.targetMove;
        //     if (!node) return;

        //     const t = node.data.training;
        //     const buckets = state.trainingConfig.buckets;
        //     const promotion = state.trainingConfig.promotion;

        //     if (method === 'recall') {
        //       // only promote recall if it was already seen (optional safety)
        //       if (!t.seen || t.disabled) return;

        //       const from = t.group;

        //       // decrement old bucket count (guard against negatives)
        //       if (from >= 0 && from < chapter.bucketEntries.length) {
        //         chapter.bucketEntries[from] = Math.max(0, chapter.bucketEntries[from] - 1);
        //       }

        //       let to = from;
        //       if (promotion === 'most') to = buckets.length - 1;
        //       else to = Math.min(from + 1, buckets.length - 1);

        //       // increment new bucket count
        //       if (to >= 0 && to < chapter.bucketEntries.length) {
        //         chapter.bucketEntries[to] = (chapter.bucketEntries[to] ?? 0) + 1;
        //       }

        //       timeToAdd = buckets[to] ?? 0;

        //       t.group = to;
        //       t.dueAt = nowSec + timeToAdd;
        //     } else {
        //       // learn
        //       if (t.disabled) return;

        //       // mark seen + place in first bucket
        //       console.log('training array', t);
        //       t.seen = true;
        //       console.log('training array', t);

        //       t.group = 0;

        //       timeToAdd = buckets[0] ?? 0;
        //       t.dueAt = nowSec + timeToAdd;

        //       // if it was previously unseen, count it into bucket 0
        //       chapter.bucketEntries[0] = (chapter.bucketEntries[0] ?? 0) + 1;
        //     }

        //     // store-owned UI flags (recommended)
        //     state.lastResult = 'succeed';
        //     state.showSuccessfulGuess = method === 'recall';

        //     chapter.dirty = true;
        //     chapter.lastDueCount = chapter.bucketEntries[0] ?? 0; // if you track this
        //   }),
        // );

        // return timeToAdd;
      },

      fail: () => {
        // setShowSuccessfulGuess(false);
        const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig } = get();
        const node = trainableContext.targetMove;

        //TODO need more recent version?
        const chapter = repertoire[repertoireIndex];
        if (!node) return;
        let groupIndex = node.data.training.group;
        chapter.bucketEntries[groupIndex]--;
        if (trainingMethod === 'recall') {
          switch (trainingConfig!.demotion) {
            case 'most':
              groupIndex = 0;
              break;
            case 'next':
              groupIndex = Math.max(groupIndex - 1, 0);
              break;
          }
          chapter.bucketEntries[groupIndex]++;
          const interval = trainingConfig!.buckets![groupIndex];

          node.data.training.group = groupIndex;
          node.data.training.dueAt = currentTime() + interval;
        }
      },

      //TODO
      guess: (san: string): TrainingOutcome => {
        const { repertoire, repertoireIndex, selectedPath, lastGuess, trainableContext, trainingMethod } =
          get();
        const chapter = repertoire[repertoireIndex];
        const root = chapter.root;
        //TODO what about multiple roots?

        const target = trainableContext.targetMove;
        const pathToTrain = trainableContext.startingPath;
        const TrainableNodeList: ChildNode<TrainingData>[] = getNodeList(root, pathToTrain);

        if (repertoireIndex == -1 || !TrainableNodeList || trainingMethod == 'learn') return;
        let possibleMoves = TrainableNodeList.at(-1).children.map((_) => _.data.san);
        set({ lastGuess: san });
        return possibleMoves.includes(san) ? (target.data.san === san ? 'success' : 'alternate') : 'failure';
      },

      markAllAsSeen: () => {
        const nowSec = currentTime();

        set(
          produce((state) => {
            const idx = state.repertoireIndex;
            if (idx < 0) return;

            const chapter = state.repertoire[idx];
            if (!chapter) return;

            const buckets = state.trainingConfig.buckets;
            const timeToAdd = buckets?.[0] ?? 0;

            // if you keep your old string "" path meaning "root", you can just use []
            // const startPath: string[] = []; // whole tree

            updateRecursive(chapter.tree, '', (node) => {
              const t = node.data.training;

              // choose semantics:
              // - "markAllAsSeen" might mean "mark unseen nodes as seen"
              // - ignore disabled nodes
              if (t.disabled) return;

              // If you only want to affect unseen nodes (prevents double counting):
              if (t.seen) return;

              // update bucket entries: node goes into group 0
              chapter.bucketEntries[0] = (chapter.bucketEntries[0] ?? 0) + 1;

              t.seen = true;
              t.group = 0;
              t.dueAt = nowSec + timeToAdd;
            });

            // chapter.dirty = true;
            // state.lastResult = null;
            state.showSuccessfulGuess = false;
          }),
        );
      },

      //TODO hover over this option in context menu should highlight which nodes are being disabled
      disableLine: (path: string) => {
        const { repertoire, repertoireIndex, updateDueCounts } = get();
        const root = repertoire[repertoireIndex].root;
        updateRecursive(root, path, (node) => {
          node.data.training.disabled = true;
        });
        updateDueCounts();
      },

      enableLine: (path: string) => {
        const { repertoire, repertoireIndex, updateDueCounts } = get();
        const chapter = repertoire[repertoireIndex];
        const trainAs = chapter.trainAs;
        updateRecursive(chapter.root, path, (node) => {
          const color: Color = colorFromPly(node.data.ply);
          if (trainAs == color) {
            node.data.training.disabled = false;
          }
        });
        updateDueCounts();
      },

      //TODO put in state
      makeMove: (san: string) => {
        const { selectedNode, repertoire, repertoireIndex, selectedPath } = get();

        const fen = selectedNode.data.fen;
        if (!selectedNode.children.map((_) => _.data.san).includes(san)) {
          const [pos, error] = positionFromFen(fen);
          const move = parseSan(pos, san);

          const newNode: TrainableNode = {
            data: {
              training: {
                disabled: !selectedNode.data.training.disabled,
                seen: false, //TODO just use group and dueAt?
                group: -1,
                dueAt: -1,
              },
              ply: selectedNode.data.ply + 1,
              id: scalachessCharPair(move),
              san: makeSanAndPlay(pos, move),
              fen: makeFen(pos.toSetup()),
              comment: '',
            },
            children: [],
          };

          // update chapter-wide metadata if necessary
          if (!newNode.data.training.disabled) repertoire[repertoireIndex].nodeCount++;
          selectedNode.children.push(newNode);
        }

        const movingTo = selectedNode.children.find((x) => x.data.san == san);

        const newPath = selectedPath + movingTo.data.id;

        /*
          Update state
          */

        set({ selectedNode: movingTo, selectedPath: newPath });

        //TODO update due counts, use builtin tree operations

        /*
            find SAN in children
            if its not there, add it
            set currentNode, currentPath, etc... 
      
            other stuff shuld automatically work out??? 
      
          */

        /* Make the move
      
            if newPath
              add node
            else 
              adjust position 
              assume all other data can be derived from position change 
      
      
      
      
      
      
      
          */
        // return (orig, dest) => {
        //   chess.move({from: orig, to: dest});
        //   cg.set({
        //     turnColor: toColor(chess),
        //     movable: {
        //       color: toColor(chess),
        //       dests: toDests(chess)
        //     }
        //   });
        // };
      },

      addNewChapter: (chapter: Chapter) => {
        const { repertoire, trainingConfig } = get();
        console.log('BUG | adding this chapter', chapter);

        // const chapter = chapterFromPgn(rawPgn, asColor, name, trainingConfig);
        let newRepertoire;

        // TODO handle correct placement
        switch (chapter.trainAs) {
          case 'white':
            newRepertoire = [chapter, ...repertoire];
            break;

          case 'black':
            newRepertoire = [...repertoire, chapter];
            break;
        }

        set({ repertoire: newRepertoire });
      },

      // TODO immer set?
      importIntoChapter: (targetChapter: number, newPgn: string) => {
        const { repertoire } = get();
        const chapter = repertoire[targetChapter];
        let parsedPgn: TrainableNode;

        const { root: importRoot, nodeCount } = rootFromPgn(newPgn, chapter.trainAs);

        const currentRoot = chapter.root;
        // should change currentRoot in place
        merge(currentRoot, importRoot);

        // TODO edit chapter metadata
        // nothing more?

        set({ repertoire });
      },
    }),
    {
      name: 'trainer-store', // IndexedDB key
      storage: indexedDBStorage,
      partialize: (state) => ({
        // only persist long-term data
        repertoire: state.repertoire,
        repertoireIndex: state.repertoireIndex,
        trainingConfig: state.trainingConfig,
      }),
    },
  ),
);
