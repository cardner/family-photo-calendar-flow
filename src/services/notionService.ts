import { NotionEvent, NotionPage } from '@/types/notion';
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

interface DatabaseTestResult {
  success: boolean;
  database?: any;
  properties?: DatabaseProperties;
  samplePages?: any[];
  error?: string;
}

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
      console.log(`🧪 Testing database access for ID: ${databaseId}`);
      
      // Get database metadata
      const database = await notionAPIClient.getDatabase(databaseId, token);
      
      // Extract properties
      const properties: DatabaseProperties = {};
      for (const [key, prop] of Object.entries(database.properties || {})) {
        if (prop && typeof prop === 'object' && 'type' in prop) {
          properties[key] = {
            id: (prop as any).id || key,
            name: key,
            type: (prop as any).type
          };
        }
      }

      // Query for sample pages (limit to 3 for preview)
      const queryResult = await notionAPIClient.queryDatabase(databaseId, token);

      return {
        success: true,
        database,
        properties,
        samplePages: queryResult.results?.slice(0, 3) || [],
      };
    } catch (error) {
      console.error('Database test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get database with full query capability
  async queryDatabaseFull(databaseId: string, token: string, options: {
    filter?: any;
    sorts?: any[];
    pageSize?: number;
  } = {}): Promise<any> {
    try {
      const { filter, sorts } = options;
      
      return await notionAPIClient.queryDatabase(databaseId, token, filter);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage);
    }
  }

  async getIntegrationInfo(token: string): Promise<NotionIntegrationInfo> {
    if (!this.validateTokenFormat(token)) {
      throw new Error('Invalid token format. Notion tokens should start with "ntn_" and be at least 50 characters long.');
    }

    try {
      console.log('🔐 Getting Notion integration info...');
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
      throw new Error(`Failed to retrieve integration information: ${errorMessage}`);
    }
  }

  async getPage(pageId: string, token: string): Promise<any> {
    try {
      return await notionAPIClient.getPage(pageId, token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage);
    }
  }

  async getDatabase(databaseId: string, token: string): Promise<any> {
    try {
      return await notionAPIClient.getDatabase(databaseId, token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage);
    }
  }

  async queryDatabase(databaseId: string, token: string, filter?: any): Promise<any> {
    try {
      return await notionAPIClient.queryDatabase(databaseId, token, filter);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(errorMessage);
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

  private extractTitle(page: any): string {
    const properties = page.properties;
    
    // First, look for a "Calendar Name" property
    for (const [key, property] of Object.entries(properties)) {
      if (key.toLowerCase().includes('calendar') && key.toLowerCase().includes('name')) {
        if (property && typeof property === 'object' && 'type' in property) {
          if (property.type === 'rich_text' && 'rich_text' in property && property.rich_text) {
            const richTextArray = property.rich_text as any[];
            if (Array.isArray(richTextArray)) {
              const titleText = richTextArray
                .map((text: any) => text.plain_text)
                .join('');
              if (titleText && titleText.trim()) return titleText.trim();
            }
          } else if (property.type === 'select' && 'select' in property && property.select) {
            const selectValue = (property as any).select.name;
            if (selectValue && selectValue.trim()) return selectValue.trim();
          }
        }
      }
    }
    
    // Then find title property as fallback
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'title' && 'title' in property && property.title) {
        // Add proper type assertion and array check
        const titleArray = property.title as any[];
        if (Array.isArray(titleArray)) {
          const titleText = titleArray
            .map((text: any) => text.plain_text)
            .join('');
          if (titleText && titleText.trim()) return titleText.trim();
        }
      }
    }
    
    return 'Untitled';
  }

  private extractDate(page: any): Date {
    const properties = page.properties;
    
    // Look for date properties
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'date' && 'date' in property && (property as any).date?.start) {
        return new Date((property as any).date.start);
      }
    }
    
    return new Date(page.created_time);
  }

  private extractTime(page: any): string | null {
    const properties = page.properties;
    
    // Look for date properties with time
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'date' && 'date' in property && (property as any).date?.start) {
        const dateString = (property as any).date.start;
        const timeMatch = dateString.match(/T(\d{2}:\d{2})/);
        return timeMatch ? timeMatch[1] : null;
      }
    }
    
    return null;
  }

  private extractDescription(page: any): string {
    const properties = page.properties;
    
    // Look for rich text properties that might contain description
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property && property.type === 'rich_text' && 'rich_text' in property && (property as any).rich_text) {
        // Add proper type assertion and array check
        const richTextArray = (property as any).rich_text as any[];
        if (Array.isArray(richTextArray)) {
          const description = richTextArray
            .map((text: any) => text.plain_text)
            .join('');
          if (description) return description;
        }
      }
    }
    
    return '';
  }

  private extractLocation(page: any): string {
    const properties = page.properties;
    
    // Look for properties that might contain location info
    for (const [key, property] of Object.entries(properties)) {
      const keyLower = key.toLowerCase();
      
      if (keyLower.includes('location')) {
        if (property && typeof property === 'object' && 'type' in property && property.type === 'rich_text' && 'rich_text' in property && (property as any).rich_text) {
          // Add proper type assertion and array check
          const richTextArray = (property as any).rich_text as any[];
          if (Array.isArray(richTextArray)) {
            const location = richTextArray
              .map((text: any) => text.plain_text)
              .join('');
            if (location) return location;
          }
        }
        
        if (property && typeof property === 'object' && 'type' in property && property.type === 'select' && 'select' in property && (property as any).select) {
          return (property as any).select.name || '';
        }
      }
    }
    
    return '';
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      console.log('🔐 Validating Notion token...');
      
      if (!this.validateTokenFormat(token)) {
        console.error('❌ Invalid token format');
        return false;
      }

      const isValid = await notionAPIClient.validateToken(token);
      console.log('✅ Notion token validation successful');
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
      console.log('Database access failed, trying page...');
    }

    // Try page
    try {
      await notionAPIClient.getPage(pageId, token);
      return { hasAccess: true, resourceType: 'page' };
    } catch (error) {
      console.log('Page access failed');
    }

    return { 
      hasAccess: false, 
      resourceType: null, 
      error: 'Page/database not shared with integration or does not exist' 
    };
  }
}

export const notionService = new NotionService();
