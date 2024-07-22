import { NewSubrepertoire } from '../types/types';

export const fetchSubrepertoires = async (): Promise<NewSubrepertoire[]> => {
  const url = 'http://localhost:8080/subrepertoires';
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
    const subreps: NewSubrepertoire[] = json.map((subrep: any) => {
      return {
        pgn: subrep.pgn,
        color: subrep.color === 1 ? 'black' : 'white',
        alias: `part ${subrep.id}`
      };
    });
    return subreps;
  } catch (error) {
    console.error('Error fetching repertoires:', error);
    return []; // You can return an empty array or any other default value depending on your needs
  }
};
