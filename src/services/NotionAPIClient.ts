import type {
  PageObjectResponse,
  DatabaseObjectResponse,
  QueryDatabaseResponse,
} from '@notionhq/client/build/src/api-endpoints';

/**
 * Notion API Client with CORS Proxy
 * 
 * Handles all Notion API calls through a CORS proxy to resolve browser CORS restrictions.
 */

interface NotionRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

interface ProxyResponse {
  contents: string;
  status: {
    http_code: number;
  };
}

export class NotionAPIClient {
  // Direct Notion REST base (used in production only when behind a trusted proxy we control)
  private readonly baseURL = 'https://api.notion.com/v1';
  private readonly proxyURL = 'http://192.168.50.185:40091/proxy';

  // Determine runtime environment capabilities
  private get useDevProxy(): boolean {
    // In Vite dev we expose a local proxy at /notion -> https://api.notion.com/v1
    return typeof window !== 'undefined' && !!import.meta.env?.DEV;
  }

  private resolveUrl(endpoint: string): string {
    if (this.useDevProxy) {
      return `/notion${endpoint}`;
    }
    return `${this.proxyURL}${endpoint}`;
  }

  private async makeRequest<T = unknown>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
    const url = this.resolveUrl(endpoint);

    // Prepare headers (Authorization is required by Notion; okay in dev since user supplies their own token locally)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    // If not using dev proxy AND running in browser, warn about likely CORS failure
    if (!this.useDevProxy && typeof window !== 'undefined' && !url.startsWith(this.proxyURL)) {
      console.warn('[NotionAPIClient] Direct browser call to Notion API – this will likely fail due to CORS. Configure a serverless proxy or deploy with one.');
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error(`Notion API request failed for ${endpoint}:`, error);
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (error && typeof error === 'object') {
      const errObj = error as { code?: string; message?: string };
      if (errObj.code) {
        switch (errObj.code) {
          case 'unauthorized':
            return new Error('Invalid Notion token. Please check your integration token and ensure it has the correct permissions.');
          case 'restricted_resource':
            return new Error('Access forbidden. Please ensure your integration has access to the requested page or database.');
          case 'object_not_found':
            return new Error('Page or database not found. Please check the URL and ensure the page/database exists and is shared with your integration.');
          case 'rate_limited':
            return new Error('Rate limit exceeded. Please wait a moment and try again.');
          default:
            return new Error(`Notion API error: ${errObj.message || 'Unknown error'}`);
        }
      }
      if (errObj.message) {
        if (errObj.message.includes('Failed to fetch') || errObj.message.includes('NetworkError')) {
          return new Error('Network error: Unable to reach Notion API. Please check your internet connection and try again.');
        }
        return new Error(`Unexpected error: ${errObj.message}`);
      }
    }
    return new Error('An unknown error occurred while connecting to Notion.');
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await this.makeRequest('/users/me', token);
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getIntegrationInfo(token: string): Promise<{ type?: string; name?: string; workspace?: { name?: string; id?: string } }> {
    return this.makeRequest('/users/me', token);
  }

  async getDatabase(databaseId: string, token: string): Promise<DatabaseObjectResponse> {
    return this.makeRequest(`/databases/${databaseId}`, token);
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
    return this.makeRequest(`/databases/${databaseId}/query`, token, {
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
    const all: PageObjectResponse[] = [];
    let cursor: string | undefined = undefined;

    do {
      const res = await this.queryDatabase(databaseId, token, {
        filter,
        start_cursor: cursor,
        page_size: pageSize,
      });

      // Append current batch
      all.push(...(res.results as PageObjectResponse[]));

      // Prepare for next loop
      cursor = res.has_more ? (res.next_cursor as string | null) || undefined : undefined;
    } while (cursor);

    return all;
  }

  async getPage(pageId: string, token: string): Promise<PageObjectResponse> {
    return this.makeRequest(`/pages/${pageId}`, token);
  }
}

export const notionAPIClient = new NotionAPIClient();
