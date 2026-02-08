import { Chapter, Color, FlatChapter, MoveRow, TrainableNode, TrainingData } from '../types/training';
import { flattenChapter } from './util';

const API_URL = import.meta.env.VITE_API_URL;

/*
  POST chapter to chessrepeat backend 

*/
export async function postChapter(chapter: Chapter) {
  const normalizedChapter = flattenChapter(chapter);
  console.log('Flattened chapter', normalizedChapter);

  const res = await fetch(`${API_URL}/api/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizedChapter),
    credentials: 'include', // sends the session cookie
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Create chapter failed (${res.status}): ${text}`);
  }
  return res.json(); // { id, revision } (or whatever your backend returns)
}

// TODO types
// should have canonical flattened type?
export async function apiGetChapters(): Promise<FlatChapter[]> {
  const res = await fetch(`${API_URL}/api/chapters`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`GET /api/chapters failed: ${res.status}`);
  const data = await res.json();
  console.log('DATA', data);
  return data.chapters;
}



/**
 * POST /api/chapters/{chapterId}/moves
 * Backend expects: { move: MoveDTO }
 */

//TODO chapter id should be just a number? or something more lightweight.. 
export async function apiAddMove(chapterId: string, move: MoveRow) {
  const res = await fetch(`${API_URL}/api/chapters/${chapterId}/moves`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ move }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST /api/chapters/${chapterId}/moves failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.move; // canonical move echoed from backend
}

export type MoveTrainingPatch = {
  disabled?: boolean;
  seen?: boolean;
  group?: number;
  dueAt?: number;
};

export async function apiTrainMove(chapterId: string, idx: number, patch: MoveTrainingPatch) {
  const res = await fetch(`${API_URL}/api/chapters/${chapterId}/moves/${idx}/training`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PATCH training failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.move;
}









export type TrainingPatch = {
  disabled?: boolean;
  seen?: boolean;
  group?: number;
  dueAt?: number;
};

//TODO make a bunch of fields on the MoveRow type optional instead AND rename moveRow 
export type MovePatch = {
  id?: string;
  parentIdx?: number; // (if you need to clear parentIdx, we’ll do a separate nullable type)
  ord?: number;
  fen?: string;
  ply?: number;
  san?: string;
  comment?: string;
  training?: TrainingPatch;
};

export type MoveEdit = { idx: number; patch: MovePatch };

export async function apiEditMoves(chapterId: string, edits: MoveEdit[]) {
  const res = await fetch(`${API_URL}/api/chapters/${chapterId}/edit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ edits }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST /api/chapters/${chapterId}/edit failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.moves;
}
