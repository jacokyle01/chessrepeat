import { NewChapter } from '../types/types';
import { baseUrl } from './constants';

export const fetchChapters = async (): Promise<NewChapter[]> => {
  const url = baseUrl + '/chapters';
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();
    const subreps: NewChapter[] = json.map((subrep: any) => {
      return {
        pgn: subrep.pgn,
        trainAs: subrep.color === 1 ? 'black' : 'white',
        alias: subrep.alias,
      };
    });
    return subreps;
  } catch (error) {
    console.error('Error fetching repertoires:', error);
    return []; // You can return an empty array or any other default value depending on your needs
  }
};
