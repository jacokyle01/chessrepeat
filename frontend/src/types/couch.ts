// export type ChapterMetaDoc = {
//   _id: string;
//   _rev?: string;
//   type: 'chapter';
//   sub: string;
//   chapterId: string;

//   name: string;
//   trainAs: Color;
//   lastDueCount: number;
//   enabledCount: number;
//   bucketEntries: number[];
//   largestMoveId: number;

//   // optional: timestamps
//   updatedAt: number;
// };

// export type NodeDoc = {
//   _id: string;
//   _rev?: string;
//   type: 'node';
//   sub: string;
//   chapterId: string;

//   idx: number;            // your node.data.idx (unique per chapter)
//   parentIdx: number | null;
//   ord: number;            // sibling order under parent

//   // flattened copy of TrainingData fields
//   ply: number;
//   id: string;             // move id (scalachessCharPair) etc
//   san: string;
//   fen: string;
//   comment: string;

//   training: {
//     disabled: boolean;
//     seen: boolean;
//     group: number;
//     dueAt: number;
//   };

//   updatedAt: number;
// };

// export type IndexDoc = {
//   _id: string;
//   _rev?: string;
//   type: 'index';
//   sub: string;
//   chapterIds: string[];
//   updatedAt: number;
// };
