async move(o?: SoundMoveOpts) {
  const volume = o?.volume ?? 1;
  if (o?.filter !== 'music' && this.theme !== 'music') {
    if (o?.name) this.throttled(o.name, volume);
    else {
      if (o?.san?.includes('x')) this.throttled('capture', volume);
      else this.throttled('move', volume);
      if (o?.san?.includes('#')) {
        this.throttled('checkmate', volume);
      } else if (o?.san?.includes('+')) {
        this.throttled('check', volume);
      }
    }
  }
  if (o?.filter === 'game' || this.theme !== 'music') return;
  this.music ??= await site.asset.loadEsm<SoundMove>('bits.soundMove');
  this.music(o);
}

throttled = throttle(100, (name: Name, volume: number) => this.play(name, volume));

async play(name: Name, volume = 1): Promise<void> {
  if (!this.enabled()) return;
  const sound = await this.load(name);
  if (sound && (await this.resumeWithTest())) await sound.play(this.getVolume() * volume);
}


async load(name: Name, path?: Path): Promise<Sound | undefined> {
  if (!this.ctx) return;
  if (path) this.paths.set(name, path);
  else path = this.paths.get(name) ?? this.resolvePath(name);
  if (!path) return;
  if (this.sounds.has(path)) return this.sounds.get(path);

  const result = await fetch(path);
  if (!result.ok) throw new Error(`${path} failed ${result.status}`);

  const arrayBuffer = await result.arrayBuffer();
  const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
    if (this.ctx?.decodeAudioData.length === 1)
      this.ctx?.decodeAudioData(arrayBuffer).then(resolve).catch(reject);
    else this.ctx?.decodeAudioData(arrayBuffer, resolve, reject);
  });
  const sound = new Sound(this.ctx, audioBuffer);
  this.sounds.set(path, sound);
  return sound;
}


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