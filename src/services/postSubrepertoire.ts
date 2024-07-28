import { baseUrl } from './constants';

export const postSubrepertoire = async (pgn: string, color: string, alias: string) => {
  const url = baseUrl + '/subrepertoire';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        color: color === 'white', // white = true, black = false
        pgn,
        alias
      }),
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
