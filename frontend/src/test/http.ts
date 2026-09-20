import { vi } from 'vitest';

// Replace global fetch with a spy that answers with a real Response, so
// ok/status/json/text all behave. Installed with vi.spyOn so vitest's
// restoreMocks puts the original back after each test — which also
// means the alert stub from vitest.setup.ts is left alone.
export function mockFetch(status: number, body: unknown = '', headers: Record<string, string> = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(payload, { status, headers }));
}

export function mockFetchNetworkError(message = 'network down') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new TypeError(message);
  });
}

// The URL and init of the nth fetch call.
export function fetchCall(fn: ReturnType<typeof mockFetch>, n = 0): { url: string; init: RequestInit } {
  const [url, init] = fn.mock.calls[n] as unknown as [string, RequestInit];
  return { url, init: init ?? {} };
}
