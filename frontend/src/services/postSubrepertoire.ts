import { RepertoireEntry } from '../types/types';
import { baseUrl } from './constants';

export const postSubrepertoire = async (entry: RepertoireEntry, color: string, alias: string) => {
  const outgoingRequest = {
    alias: alias,
    moves: entry.subrep.moves,
    x: entry.lastDueCount,
    meta: {
      trainAs: color,
      nodeCount: entry.subrep.meta.nodeCount,
      bucketEntries: entry.subrep.meta.bucketEntries
    }
  };

  const url = baseUrl + '/games/add';
  console.log('url', url);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...outgoingRequest }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const responseData = await response.json();
    console.log('Success:', responseData);
  } catch (error) {
    console.error('Error:', error);
  }
};

// import { RepertoireEntry } from '../types/repertoire';

// export async function saveRepertoire(entry: RepertoireEntry) {
//   const response = await fetch('/games/add', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(entry),
//   });

//   if (!response.ok) {
//     throw new Error(`Failed to save repertoire: ${response.statusText}`);
//   }

//   return response.json();
// }
