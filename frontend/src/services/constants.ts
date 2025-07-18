export const baseUrl = 'http://52.14.126.128:8080';
export const lichessHost = 'https://lichess.org';
export const here = (() => {
  const url = new URL(location.href);
  url.search = '';
  return url.href;
})();
