export interface Config {
  getNext?: {
    by?: 'depth' | 'breadth'; // exploration strategy to find next position
    max?: number; //dont look at positions after this many moves
  };
  buckets?: number[]; //the "spaces" for spaced repetition. see "leitner system"
  promotion?: 'most' | 'next';
  demotion?: 'most' | 'next';
}

export function configure(curr: Config, config: Config): void {
  deepMerge(curr, config);
}

function deepMerge(base: any, extend: any): void {
  for (const key in extend) {
    if (Object.prototype.hasOwnProperty.call(extend, key)) {
      if (
        Object.prototype.hasOwnProperty.call(base, key) &&
        isPlainObject(base[key]) &&
        isPlainObject(extend[key])
      )
        deepMerge(base[key], extend[key]);
      else base[key] = extend[key];
    }
  }
}

function isPlainObject(o: unknown): boolean {
  if (typeof o !== 'object' || o === null) return false;
  const proto = Object.getPrototypeOf(o);
  return proto === Object.prototype || proto === null;
}

export function defaults(): Config {
  return {
    getNext: {
      by: 'breadth',
      max: Infinity,
    },
    buckets: [30, 86400, 259200, 604800, 1814400, 5443200, 16329600, 31536000], //30 seconds, 24 hours, 3 days, 7 days, 3 weeks, 9 weeks, 27 weeks, 1 year
    promotion: 'next',
    demotion: 'next',
  };
}
