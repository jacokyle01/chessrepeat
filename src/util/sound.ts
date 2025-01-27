

/**
 * Ensures calls to the wrapped function are spaced by the given delay.
 * Any extra calls are dropped, except the last one, which waits for the delay.
 */
export function throttle<T extends (...args: any) => void>(
  delay: number,
  wrapped: T,
): (...args: Parameters<T>) => void {
  return throttlePromise(function (this: any, ...args: Parameters<T>) {
    wrapped.apply(this, args);
    return new Promise(resolve => setTimeout(resolve, delay));
  });
}

/***
 * Wraps an asynchronous function to ensure only one call at a time is in
 * flight. Any extra calls are dropped, except the last one, which waits for
 * the previous call to complete.
 */
export function throttlePromiseWithResult<R, T extends (...args: any) => Promise<R>>(
  wrapped: T,
): (...args: Parameters<T>) => Promise<R> {
  let current: Promise<R> | undefined;
  let pending:
    | {
        run: () => Promise<R>;
        reject: () => void;
      }
    | undefined;

  return function (this: any, ...args: Parameters<T>): Promise<R> {
    const self = this;

    const runCurrent = () => {
      current = wrapped.apply(self, args).finally(() => {
        current = undefined;
        if (pending) {
          pending.run();
          pending = undefined;
        }
      });
      return current;
    };

    if (!current) return runCurrent();

    pending?.reject();
    const next = new Promise<R>((resolve, reject) => {
      pending = {
        run: () =>
          runCurrent().then(
            res => {
              resolve(res);
              return res;
            },
            err => {
              reject(err);
              throw err;
            },
          ),
        reject: () => reject(new Error('Throttled')),
      };
    });
    return next;
  };
}

/* doesn't fail the promise if it's throttled */
export function throttlePromise<T extends (...args: any) => Promise<void>>(
  wrapped: T,
): (...args: Parameters<T>) => Promise<void> {
  const throttler = throttlePromiseWithResult<void, T>(wrapped);
  return function (this: any, ...args: Parameters<T>): Promise<void> {
    return throttler.apply(this, args).catch(() => {});
  };
}