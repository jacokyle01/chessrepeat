import { TrainingConfig } from "../types/training";

export function configure(curr: TrainingConfig, config: TrainingConfig): void {
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

export function defaults(): TrainingConfig {
  return {
    getNext: {
      by: 'breadth',
      max: Infinity,
    },
    buckets: [30, 86400, 259200, 604800, 1814400, 5443200, 16329600, 31536000], //30 seconds, 24 hours, 3 days, 7 days, 3 weeks, 9 weeks, 27 weeks, 1 year
    // buckets: [2, 5, 10, 15, 1814400, 5443200, 16329600, 31536000], //30 seconds, 24 hours, 3 days, 7 days, 3 weeks, 9 weeks, 27 weeks, 1 year

    promotion: 'next',
    demotion: 'next',
  };
}
