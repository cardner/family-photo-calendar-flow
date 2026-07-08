import { NotionEvent, NotionPage, NotionDatabase, DatabaseTestResult } from '@/types/notion';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notionAPIClient } from './NotionAPIClient';

interface NotionIntegrationInfo {
  type: string;
  name: string;
  capabilities: {
    read_content: boolean;
    read_user_info: boolean;
  };
  workspace?: {
    name: string;
    id: string;
  };
}

interface DatabaseProperties {
  [key: string]: {
    id: string;
    name: string;
    type: string;
  };
}

// Narrow fragments for property access to avoid pervasive any casts
interface RichTextFragment { plain_text?: string }
interface TitleProperty { type: 'title'; title: RichTextFragment[] }
interface RichTextProperty { type: 'rich_text'; rich_text: RichTextFragment[] }
interface SelectProperty { type: 'select'; select: { name?: string } | null }
interface DateProperty { type: 'date'; date: { start?: string } | null }

function isPageObjectResponse(obj: unknown): obj is PageObjectResponse {
  return !!obj && typeof obj === 'object' && (obj as { object?: string }).object === 'page';
}

// Deprecated local DatabaseTestResult replaced by shared type

class NotionService {
  private validateTokenFormat(token: string): boolean {
    return token.startsWith('ntn_') && token.length >= 50;
  }

  // Validate database ID format
  validateDatabaseId(input: string): { isValid: boolean; id: string; type: 'id' | 'url' | 'invalid' } {
    // Remove any whitespace
    const cleanInput = input.trim();
    
    // Check if it's a direct database ID (32 character hex string)
    const directIdPattern = /^[a-f0-9]{32}$/i;
    if (directIdPattern.test(cleanInput)) {
      return { isValid: true, id: cleanInput, type: 'id' };
    }

    // Check if it's a URL and extract ID
    const extractedId = this.extractPageIdFromUrl(cleanInput);
    if (extractedId) {
      return { isValid: true, id: extractedId, type: 'url' };
    }

    return { isValid: false, id: '', type: 'invalid' };
  }

  // Test database access and get properties
  async testDatabaseAccess(databaseId: string, token: string): Promise<DatabaseTestResult> {
    try {
      // debug removed: testing database access
      
      // Get database metadata
      const database = await notionAPIClient.getDatabase(databaseId, token);
      
      // Extract properties
      const properties: DatabaseProperties = {};
      for (const [key, prop] of Object.entries(database.properties || {})) {
        if (prop && typeof prop === 'object' && 'type' in prop) {
          const typed = prop as { id?: string; type: string };
          properties[key] = {
            id: typed.id || key,
            name: key,
            type: typed.type
          };
        }
      }

      // Query for sample pages (limit to 3 for preview)
  const queryResult = await notionAPIClient.queryDatabase(databaseId, token) as { results?: unknown[] };
      const samplePages: PageObjectResponse[] = (queryResult.results || [])
        .filter((r): r is PageObjectResponse => isPageObjectResponse(r))
        .slice(0, 3);

      return {
        success: true,
        database,
        properties,
        samplePages,
      };
    } catch (error) {
      console.error('Database test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get ALL pages from a database (auto-paginated)
  async queryDatabaseFull(databaseId: string, token: string, options: { filter?: Record<string, unknown>; pageSize?: number } = {}): Promise<PageObjectResponse[]> {
    try {
      const { filter, pageSize } = options;
      const pages = await notionAPIClient.queryAll(databaseId, token, filter, pageSize);
      return pages as PageObjectResponse[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage, { cause: error });
    }
  }

  async getIntegrationInfo(token: string): Promise<NotionIntegrationInfo> {
    if (!this.validateTokenFormat(token)) {
      throw new Error('Invalid token format. Notion tokens should start with "ntn_" and be at least 50 characters long.');
    }

    try {
      // debug removed: getting integration info
      const userInfo = await notionAPIClient.getIntegrationInfo(token);
      
      return {
        type: userInfo.type || 'bot',
        name: userInfo.name || 'Unknown Integration',
        capabilities: {
          read_content: true,
          read_user_info: true
        },
        workspace: userInfo.workspace ? {
          name: userInfo.workspace.name || 'Unknown Workspace',
          id: userInfo.workspace.id || ''
        } : undefined
      };
    } catch (error) {
      console.error('Failed to get integration info:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      throw new Error(`Failed to retrieve integration information: ${errorMessage}`, { cause: error });
    }
  }

  async getPage(pageId: string, token: string): Promise<NotionPage> {
    try {
      return await notionAPIClient.getPage(pageId, token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage, { cause: error });
    }
  }

  async getDatabase(databaseId: string, token: string): Promise<NotionDatabase> {
    try {
      return await notionAPIClient.getDatabase(databaseId, token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage, { cause: error });
    }
  }

  async queryDatabase(databaseId: string, token: string, filter?: Record<string, unknown>): Promise<PageObjectResponse[]> {
    try {
      const pages = await notionAPIClient.queryAll(databaseId, token, filter);
      return pages as PageObjectResponse[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage, { cause: error });
    }
  }

  extractPageIdFromUrl(url: string): string | null {
    const patterns = [
      /notion\.so\/([a-f0-9]{32})/,
      /notion\.so\/.*-([a-f0-9]{32})/,
      /notion\.so\/.*\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].replace(/-/g, '');
      }
    }

    return null;
  }

  transformToEvents(pages: NotionPage[], calendarId: string, calendarName: string, color: string): NotionEvent[] {
    return pages.map(page => {
      const title = this.extractTitle(page);
      const date = this.extractDate(page);
      const time = this.extractTime(page) || 'All day';
      const description = this.extractDescription(page);
      const location = this.extractLocation(page);

      return {
        id: `notion_${page.id}`,
        title,
        date,
        time,
        description,
        location,
        calendarId,
        calendarName,
        source: 'notion' as const,
        color,
        properties: page.properties,
        notionPageId: page.id,
        notionUrl: page.url || `https://notion.so/${page.id}`
      };
    });
  }

  private extractTitle(page: NotionPage): string {
    const properties = page.properties;
    
    // First, look for a "Calendar Name" property
    for (const [key, property] of Object.entries(properties)) {
      if (key.toLowerCase().includes('calendar') && key.toLowerCase().includes('name')) {
        if (property && typeof property === 'object' && 'type' in property) {
          if (property.type === 'rich_text' && 'rich_text' in property && Array.isArray((property as RichTextProperty).rich_text)) {
            const richTextArray = (property as RichTextProperty).rich_text;
            const titleText = richTextArray.map(t => t.plain_text || '').join('');
            if (titleText && titleText.trim()) return titleText.trim();
          } else if (property.type === 'select' && 'select' in property && (property as SelectProperty).select?.name) {
            const selectValue = (property as SelectProperty).select?.name;
            if (selectValue && selectValue.trim()) return selectValue.trim();
          }
        }
      }
    }
    
    // Then find title property as fallback
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'title' && 'title' in property) {
        const titleProp = property as TitleProperty;
        if (Array.isArray(titleProp.title)) {
          const titleText = titleProp.title.map(t => t.plain_text || '').join('');
            if (titleText && titleText.trim()) return titleText.trim();
        }
      }
    }
    
    return 'Untitled';
  }

  private extractDate(page: NotionPage): Date {
    const properties = page.properties;
    
    // Look for date properties
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'date' && 'date' in property) {
        const dateProp = property as DateProperty;
        if (dateProp.date?.start) return new Date(dateProp.date.start);
      }
    }
    
    return new Date(page.created_time);
  }

  private extractTime(page: NotionPage): string | null {
    const properties = page.properties;
    
    // Look for date properties with time
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'date' && 'date' in property) {
        const dateProp = property as DateProperty;
        if (dateProp.date?.start) {
          const timeMatch = dateProp.date.start.match(/T(\d{2}:\d{2})/);
          return timeMatch ? timeMatch[1] : null;
        }
      }
    }
    
    return null;
  }

  private extractDescription(page: NotionPage): string {
    const properties = page.properties;
    
    // Look for rich text properties that might contain description
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'rich_text' && 'rich_text' in property) {
        const richProp = property as RichTextProperty;
        if (Array.isArray(richProp.rich_text)) {
          const description = richProp.rich_text.map(t => t.plain_text || '').join('');
          if (description) return description;
        }
      }
    }
    
    return '';
  }

  private extractLocation(page: NotionPage): string {
    const properties = page.properties;
    
    // Look for properties that might contain location info
    for (const [key, property] of Object.entries(properties)) {
      const keyLower = key.toLowerCase();
      
      if (keyLower.includes('location')) {
        if (property && typeof property === 'object' && 'type' in property) {
          if (property.type === 'rich_text' && 'rich_text' in property) {
            const richProp = property as RichTextProperty;
            if (Array.isArray(richProp.rich_text)) {
              const location = richProp.rich_text.map(t => t.plain_text || '').join('');
              if (location) return location;
            }
          } else if (property.type === 'select' && 'select' in property) {
            const selectProp = property as SelectProperty;
            return selectProp.select?.name || '';
          }
        }
      }
    }
    
    return '';
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // debug removed: validating Notion token
      
      if (!this.validateTokenFormat(token)) {
        console.error('❌ Invalid token format');
        return false;
      }

      const isValid = await notionAPIClient.validateToken(token);
  // debug removed: token validation successful
      return isValid;
    } catch (error) {
      console.error('❌ Notion token validation failed:', error);
      return false;
    }
  }

  async validateCalendarAccess(url: string, token: string): Promise<{ hasAccess: boolean; resourceType: 'page' | 'database' | null; error?: string }> {
    const pageId = this.extractPageIdFromUrl(url);
    if (!pageId) {
      return { hasAccess: false, resourceType: null, error: 'Invalid Notion URL format' };
    }

    // Try database first
    try {
      await notionAPIClient.getDatabase(pageId, token);
      return { hasAccess: true, resourceType: 'database' };
    } catch (error) {
      // debug removed: database access failed, trying page
    }

    // Try page
    try {
      await notionAPIClient.getPage(pageId, token);
      return { hasAccess: true, resourceType: 'page' };
    } catch (error) {
      // debug removed: page access failed
    }

    return { 
      hasAccess: false, 
      resourceType: null, 
      error: 'Page/database not shared with integration or does not exist' 
    };
  }
}

export const notionService = new NotionService();
