export const baseUrl = 'http://localhost:8080'
export const lichessHost = 'https://lichess.org';
export const here = (() => {
  const url = new URL(location.href);
  url.search = '';
  return url.href;
})();
