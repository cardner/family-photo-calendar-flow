import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notionAPIClient, NotionApiError } from '@/services/NotionAPIClient';

describe('NotionAPIClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('retries on 429 and succeeds', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Rate limited', code: 'rate_limited' }), {
          status: 429,
          headers: { 'retry-after': '0' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'db-id' }), { status: 200 })
      );

    const promise = notionAPIClient.getDatabase('db-id', 'token');

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ id: 'db-id' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps CORS-like fetch failures to cors_blocked', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const promise = notionAPIClient.getDatabase('db-id', 'token');
    const assertion = expect(promise).rejects.toMatchObject({
      code: 'cors_blocked',
    } as NotionApiError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('times out after retries when the request never resolves', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const promise = notionAPIClient.getDatabase('db-id', 'token');
    const assertion = expect(promise).rejects.toMatchObject({
      code: 'timeout',
    } as NotionApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
