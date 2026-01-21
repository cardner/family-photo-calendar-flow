import type {
  PageObjectResponse,
  DatabaseObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';

/**
 * Notion API Client
 *
 * Handles Notion API calls with retry/timeout logic optimized for iOS WebKit.
 * NOTE: Direct browser calls to api.notion.com may be blocked by CORS in iOS PWA.
 */

export type NotionErrorCode =
  | 'cors_blocked'
  | 'offline'
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'restricted_resource'
  | 'unauthorized'
  | 'object_not_found'
  | 'unknown';

export class NotionApiError extends Error {
  readonly code: NotionErrorCode;
  readonly status?: number;

  constructor(message: string, code: NotionErrorCode, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class NotionAPIClient {
  private readonly baseURL = 'https://api.notion.com/v1';
  private readonly defaultTimeoutMs = 12_000;
  private readonly maxRetries = 3;
  private readonly minBackoffMs = 500;
  private readonly maxConcurrent = 2;
  private inflight = 0;
  private queue: Array<() => void> = [];

  private get proxyBase(): string | null {
    if (typeof window === 'undefined') return null;
    const env = import.meta.env;
    const configured = env?.VITE_NOTION_PROXY_BASE as string | undefined;
    if (env?.DEV) {
      return configured || '/notion';
    }
    return configured || null;
  }

  private resolveUrl(endpoint: string): string {
    const proxyBase = this.proxyBase;
    if (proxyBase) {
      return `${proxyBase}${endpoint}`;
    }
    return `${this.baseURL}${endpoint}`;
  }

  private async acquireSlot(): Promise<void> {
    if (this.inflight < this.maxConcurrent) {
      this.inflight += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.inflight += 1;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.inflight = Math.max(0, this.inflight - 1);
    const next = this.queue.shift();
    if (next) next();
  }

  private async requestWithRetry<T = unknown>(
    endpoint: string,
    token: string,
    options: RequestInit = {},
    timeoutMs: number = this.defaultTimeoutMs
  ): Promise<T> {
    const url = this.resolveUrl(endpoint);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await this.acquireSlot();
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          const bodyText = await response.text();
          const parsed = this.safeParseJson(bodyText);
          const code = parsed?.code as NotionErrorCode | undefined;

          if (response.status === 429 || response.status >= 500) {
            if (attempt < this.maxRetries) {
              const delayMs = this.getRetryDelayMs(attempt, retryAfter);
              await this.sleep(delayMs);
              continue;
            }
          }

          throw this.mapResponseError(response.status, code, parsed?.message || response.statusText);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (attempt < this.maxRetries) {
            await this.sleep(this.getRetryDelayMs(attempt));
            continue;
          }
          throw new NotionApiError('Request timed out. Please try again.', 'timeout');
        }

        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        throw this.normalizeError(error);
      } finally {
        clearTimeout(timer);
        this.releaseSlot();
      }
    }

    throw new NotionApiError('Failed to reach Notion after multiple attempts.', 'network');
  }

  private safeParseJson(text: string): { code?: string; message?: string } | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private mapResponseError(status: number, code?: NotionErrorCode, message?: string): NotionApiError {
    switch (code) {
      case 'unauthorized':
        return new NotionApiError(
          'Invalid Notion token. Please check your integration token and ensure it has the correct permissions.',
          'unauthorized',
          status
        );
      case 'restricted_resource':
        return new NotionApiError(
          'Access forbidden. Please ensure your integration has access to the requested page or database.',
          'restricted_resource',
          status
        );
      case 'object_not_found':
        return new NotionApiError(
          'Page or database not found. Please check the URL and ensure the page/database exists and is shared with your integration.',
          'object_not_found',
          status
        );
      case 'rate_limited':
        return new NotionApiError('Rate limit exceeded. Please wait a moment and try again.', 'rate_limited', status);
      default:
        return new NotionApiError(message || 'Notion API error', code || 'unknown', status);
    }
  }

  private getRetryDelayMs(attempt: number, retryAfter?: string | null): number {
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (!Number.isNaN(parsed)) {
        return Math.min(parsed * 1000, 15_000);
      }
    }
    const exp = Math.min(2 ** attempt, 8);
    return Math.min(this.minBackoffMs * exp, 10_000);
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof NotionApiError) {
      return error.code === 'rate_limited' || error.code === 'network' || error.code === 'timeout';
    }
    if (error && typeof error === 'object') {
      const err = error as { message?: string };
      if (err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch')) {
        return true;
      }
    }
    return false;
  }

  private normalizeError(error: unknown): NotionApiError {
    if (error instanceof NotionApiError) return error;

    if (typeof window !== 'undefined' && !navigator.onLine) {
      return new NotionApiError('Offline: connect to the internet and try again.', 'offline');
    }

    if (error && typeof error === 'object') {
      const err = error as { message?: string };
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        return new NotionApiError(
          'Unable to reach Notion. This may be blocked by CORS in iOS PWA.',
          'cors_blocked'
        );
      }
      if (err.message) {
        return new NotionApiError(err.message, 'unknown');
      }
    }

    return new NotionApiError('An unknown error occurred while connecting to Notion.', 'unknown');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await this.requestWithRetry('/users/me', token);
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getIntegrationInfo(token: string): Promise<{ type?: string; name?: string; workspace?: { name?: string; id?: string } }> {
    return this.requestWithRetry('/users/me', token);
  }

  async getDatabase(databaseId: string, token: string): Promise<DatabaseObjectResponse> {
    return this.requestWithRetry(`/databases/${databaseId}`, token);
  }

  // Overload signatures for queryDatabase for ergonomic usage
  async queryDatabase(databaseId: string, token: string, filter?: unknown): Promise<QueryDatabaseResponse>;
  async queryDatabase(
    databaseId: string,
    token: string,
    params: { filter?: unknown; start_cursor?: string; page_size?: number }
  ): Promise<QueryDatabaseResponse>;
  /**
   * Implementation - accepts either a filter (legacy) or params object with pagination.
   */
  async queryDatabase(
    databaseId: string,
    token: string,
    third?: unknown | { filter?: unknown; start_cursor?: string; page_size?: number }
  ): Promise<QueryDatabaseResponse> {
    const params = (third && typeof third === 'object' && !Array.isArray(third) && ('filter' in third || 'start_cursor' in third || 'page_size' in third))
      ? (third as { filter?: unknown; start_cursor?: string; page_size?: number })
      : { filter: third } as { filter?: unknown; start_cursor?: string; page_size?: number };

    const { filter, start_cursor, page_size } = params;
    return this.requestWithRetry(`/databases/${databaseId}/query`, token, {
      method: 'POST',
      body: JSON.stringify({
        filter,
        start_cursor,
        page_size: page_size && page_size > 0 ? Math.min(page_size, 100) : undefined,
        sorts: [
          {
            property: 'Date',
            direction: 'ascending',
          },
        ],
      }),
    });
  }

  /**
   * Fetches ALL pages from a database by following cursors until has_more is false.
   * NOTE: Notion caps page_size at 100; we iterate to gather full result set.
   *
   * @param databaseId The target database id
   * @param token User-supplied integration token
   * @param filter Optional Notion filter object
   * @param pageSize Optional page size (<=100). Defaults to 100 for efficiency.
   * @returns Array of PageObjectResponse objects (flattened from all pages)
   */
  async queryAll(
    databaseId: string,
    token: string,
    filter?: unknown,
    pageSize: number = 100
  ): Promise<PageObjectResponse[]> {
    return this.queryAllWithOptions(databaseId, token, {
      filter,
      pageSize,
    });
  }

  async queryAllWithOptions(
    databaseId: string,
    token: string,
    options: {
      filter?: unknown;
      pageSize?: number;
      startCursor?: string;
      onPage?: (data: QueryDatabaseResponse) => void;
    }
  ): Promise<PageObjectResponse[]> {
    const all: PageObjectResponse[] = [];
    let cursor: string | undefined = options.startCursor;
    const pageSize = options.pageSize ?? 100;

    do {
      const res = await this.queryDatabase(databaseId, token, {
        filter: options.filter,
        start_cursor: cursor,
        page_size: pageSize,
      });

      // Append current batch
      all.push(...(res.results as PageObjectResponse[]));
      options.onPage?.(res);

      // Prepare for next loop
      cursor = res.has_more ? (res.next_cursor as string | null) || undefined : undefined;
    } while (cursor);

    return all;
  }

  async getPage(pageId: string, token: string): Promise<PageObjectResponse> {
    return this.requestWithRetry(`/pages/${pageId}`, token);
  }
}

export const notionAPIClient = new NotionAPIClient();
