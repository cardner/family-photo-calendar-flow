import { NotionScrapedEvent, NotionColumnMapping } from '@/types/notion';

interface ParsedTableStructure {
  headers: string[];
  rows: string[][];
  columnMappings: NotionColumnMapping;
}

interface TableParseResult {
  events: NotionScrapedEvent[];
  columnMappings: NotionColumnMapping;
  metadata: {
    totalRows: number;
    successfullyParsed: number;
    viewType: string;
  };
}

export interface NotionDebugInfo {
  foundElements: {
    totalBlockElements: number;
    elementsWithColumns: number;
    sampleElements: Array<{
      blockId: string;
      columnCount: number;
      cellData: string[];
    }>;
  };
  extractedData: {
    headers: string[];
    allRows: Array<{
      rowIndex: number;
      cellData: string[];
      isEmpty: boolean;
      isHeader: boolean;
    }>;
  };
  columnAnalysis: {
    detectedMappings: NotionColumnMapping;
    mappingReasons: Record<string, string>;
  };
  eventCreation: {
    validEvents: Array<{
      rowIndex: number;
      title: string;
      date: string;
      reason: string;
    }>;
    skippedRows: Array<{
      rowIndex: number;
      cellData: string[];
      reason: string;
    }>;
  };
  parsingStrategy: {
    strategy: 'modern-data-attributes' | 'legacy-css-classes' | 'fallback';
    elementsFound: number;
    successRate: number;
  };
}

export interface NotionDebugResult extends TableParseResult {
  debugInfo: NotionDebugInfo;
}

export class NotionTableParser {
  private readonly modernSelectors = {
    // Modern Notion selectors using data attributes
    dataBlockRows: '[data-block-id]',
    columnCells: '[data-column-index]',
    // Fallback selectors for compatibility
    fallbackTable: '.notion-table-view',
    fallbackRows: '.notion-table-row',
    fallbackCells: '.notion-table-cell, .notion-selectable'
  };

  private debugMode = false;
  private debugInfo: NotionDebugInfo | null = null;

  parseTableStructure(doc: Document, sourceUrl: string): TableParseResult {
  // debug removed: starting enhanced table structure parsing
    
    // Try modern data-attribute parsing first
    let parseResult = this.parseModernNotionStructure(doc, sourceUrl);
    
    // Fallback to legacy CSS class parsing
    if (!parseResult || parseResult.events.length === 0) {
  // debug removed: falling back to legacy CSS class parsing
      parseResult = this.parseLegacyNotionStructure(doc, sourceUrl);
    }

    return parseResult || {
      events: [],
      columnMappings: {},
      metadata: {
        totalRows: 0,
        successfullyParsed: 0,
        viewType: 'unknown'
      }
    };
  }

  parseWithDebug(doc: Document, sourceUrl: string): NotionDebugResult {
    this.debugMode = true;
    this.debugInfo = {
      foundElements: { totalBlockElements: 0, elementsWithColumns: 0, sampleElements: [] },
      extractedData: { headers: [], allRows: [] },
      columnAnalysis: { detectedMappings: {}, mappingReasons: {} },
      eventCreation: { validEvents: [], skippedRows: [] },
      parsingStrategy: { strategy: 'modern-data-attributes', elementsFound: 0, successRate: 0 }
    };

  // debug removed: debug mode starting enhanced parsing
    
    const parseResult = this.parseTableStructure(doc, sourceUrl);
    
    // Calculate success rate
    if (this.debugInfo) {
      const totalProcessed = this.debugInfo.extractedData.allRows.length;
      const successfulEvents = parseResult.events.length;
      this.debugInfo.parsingStrategy.successRate = totalProcessed > 0 ? (successfulEvents / totalProcessed) * 100 : 0;
    }

    this.debugMode = false;
    
    return {
      ...parseResult,
      debugInfo: this.debugInfo!
    };
  }

  private logDebug(message: string, data?: unknown) {
    if (this.debugMode) {
      // debug removed: console.log suppressed
    }
  }

  private parseModernNotionStructure(doc: Document, sourceUrl: string): TableParseResult | null {
    // debug removed: attempting modern data-attribute parsing
    
    // Find all elements with data-block-id (these are rows)
    const rowElements = doc.querySelectorAll(this.modernSelectors.dataBlockRows);
  // debug removed: found data-block-id elements

    if (this.debugMode && this.debugInfo) {
      this.debugInfo.foundElements.totalBlockElements = rowElements.length;
      this.debugInfo.parsingStrategy.strategy = 'modern-data-attributes';
      this.debugInfo.parsingStrategy.elementsFound = rowElements.length;
    }

    if (rowElements.length === 0) {
      return null;
    }

    const events: NotionScrapedEvent[] = [];
    let columnMappings: NotionColumnMapping = {};
    let headers: string[] = [];
    let isFirstRow = true;

    rowElements.forEach((row, rowIndex) => {
      // Find all cells with data-column-index within this row
      const cellElements = row.querySelectorAll(this.modernSelectors.columnCells);
      
      if (cellElements.length === 0) {
  // debug removed: row has no column cells, skipping
        this.logDebug(`Row ${rowIndex} has no column cells, skipping`);
        return;
      }

      if (this.debugMode && this.debugInfo && rowIndex < 5) {
        // Store sample elements for debugging
        this.debugInfo.foundElements.sampleElements.push({
          blockId: row.getAttribute('data-block-id') || 'unknown',
          columnCount: cellElements.length,
          cellData: Array.from(cellElements).map(cell => (cell.textContent || '').trim())
        });
      }

      // Sort cells by column index to maintain proper order
      const sortedCells = Array.from(cellElements).sort((a, b) => {
        const indexA = parseInt(a.getAttribute('data-column-index') || '0');
        const indexB = parseInt(b.getAttribute('data-column-index') || '0');
        return indexA - indexB;
      });

      const cellData = sortedCells.map(cell => (cell.textContent || '').trim());
      
  // debug removed: row cell data
      this.logDebug(`Row ${rowIndex}: Found ${cellData.length} cells`, cellData);

      // Track all rows in debug mode
      if (this.debugMode && this.debugInfo) {
        const isEmpty = cellData.every(cell => cell.length === 0);
        this.debugInfo.extractedData.allRows.push({
          rowIndex,
          cellData,
          isEmpty,
          isHeader: isFirstRow && cellData.some(cell => cell.length > 0)
        });
        this.debugInfo.foundElements.elementsWithColumns++;
      }

      // Use first non-empty row as headers
      if (isFirstRow && cellData.some(cell => cell.length > 0)) {
        headers = cellData.map((cell, index) => cell || `Column ${index + 1}`);
        columnMappings = this.createColumnMappings(headers);
  // debug removed: headers identified
        this.logDebug('Headers identified', headers);
        
        if (this.debugMode && this.debugInfo) {
          this.debugInfo.extractedData.headers = headers;
          this.debugInfo.columnAnalysis.detectedMappings = columnMappings;
        }
        
        isFirstRow = false;
        return;
      }

      // Skip empty rows
      if (cellData.every(cell => cell.length === 0)) {
        if (this.debugMode && this.debugInfo) {
          this.debugInfo.eventCreation.skippedRows.push({
            rowIndex,
            cellData,
            reason: 'Empty row - all cells are empty'
          });
        }
        return;
      }

      // Create event from row data if we have headers
      if (headers.length > 0) {
        const event = this.createEventFromRowData(cellData, headers, columnMappings, sourceUrl, rowIndex);
        if (event) {
          events.push(event);
          // debug removed: created event from row
          this.logDebug(`Created event from row ${rowIndex}`, { title: event.title, date: event.date });
          
          if (this.debugMode && this.debugInfo) {
            this.debugInfo.eventCreation.validEvents.push({
              rowIndex,
              title: event.title,
              date: event.date.toISOString(),
              reason: 'Valid event - has required title and date'
            });
          }
        } else {
          if (this.debugMode && this.debugInfo) {
            this.debugInfo.eventCreation.skippedRows.push({
              rowIndex,
              cellData,
              reason: 'Invalid event - missing required title or date'
            });
          }
        }
      }
    });

    return {
      events,
      columnMappings,
      metadata: {
        totalRows: rowElements.length,
        successfullyParsed: events.length,
        viewType: 'modern-data-attributes'
      }
    };
  }

  private parseLegacyNotionStructure(doc: Document, sourceUrl: string): TableParseResult | null {
  // debug removed: attempting legacy css parsing
    
    // Try to find legacy Notion table structure
    const tableView = doc.querySelector(this.modernSelectors.fallbackTable);
    if (!tableView) {
  // debug removed: no legacy table structure found
      return null;
    }

    const events: NotionScrapedEvent[] = [];
    const rowElements = tableView.querySelectorAll(this.modernSelectors.fallbackRows);
    
  // debug removed: legacy row count

    // Extract headers (first row or dedicated header)
    const firstRow = rowElements[0];
    if (!firstRow) {
      return null;
    }

    const headerCells = firstRow.querySelectorAll(this.modernSelectors.fallbackCells);
    const headers = Array.from(headerCells).map(cell => 
      (cell.textContent || '').trim().toLowerCase()
    ).filter(header => header.length > 0);

    if (headers.length === 0) {
  // debug removed: no headers found
      return null;
    }

  // debug removed: legacy headers found
    const columnMappings = this.createColumnMappings(headers);

    // Process data rows (skip header row)
    Array.from(rowElements).slice(1).forEach((row, rowIndex) => {
      const cells = row.querySelectorAll(this.modernSelectors.fallbackCells);
      const cellData = Array.from(cells).map(cell => (cell.textContent || '').trim());
      
      const event = this.createEventFromRowData(cellData, headers, columnMappings, sourceUrl, rowIndex);
      if (event) {
        events.push(event);
      }
    });

    return {
      events,
      columnMappings,
      metadata: {
        totalRows: rowElements.length,
        successfullyParsed: events.length,
        viewType: 'legacy-css-classes'
      }
    };
  }

  private createColumnMappings(headers: string[]): NotionColumnMapping {
    const mappings: NotionColumnMapping = {};

    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase();
      let mappingReason: string;
      
      // Map common column names to types
      if (this.isDateColumn(lowerHeader)) {
        mappings[header] = { type: 'date', propertyName: 'date' };
        mappingReason = 'Detected as date column based on header keywords';
      } else if (this.isTitleColumn(lowerHeader)) {
        mappings[header] = { type: 'title', propertyName: 'title' };
        mappingReason = 'Detected as title column based on header keywords';
      } else if (this.isStatusColumn(lowerHeader)) {
        mappings[header] = { type: 'status', propertyName: 'status' };
        mappingReason = 'Detected as status column based on header keywords';
      } else if (this.isLocationColumn(lowerHeader)) {
        mappings[header] = { type: 'location', propertyName: 'location' };
        mappingReason = 'Detected as location column based on header keywords';
      } else if (this.isCategoryColumn(lowerHeader)) {
        mappings[header] = { type: 'category', propertyName: 'categories' };
        mappingReason = 'Detected as category column based on header keywords';
      } else if (this.isDescriptionColumn(lowerHeader)) {
        mappings[header] = { type: 'description', propertyName: 'description' };
        mappingReason = 'Detected as description column based on header keywords';
      } else if (this.isTimeColumn(lowerHeader)) {
        mappings[header] = { type: 'time', propertyName: 'time' };
        mappingReason = 'Detected as time column based on header keywords';
      } else if (this.isPriorityColumn(lowerHeader)) {
        mappings[header] = { type: 'priority', propertyName: 'priority' };
        mappingReason = 'Detected as priority column based on header keywords';
      } else {
        mappings[header] = { type: 'custom', propertyName: `custom_${index}` };
        mappingReason = 'No specific type detected, marked as custom column';
      }

      // Store mapping reason for debug
      if (this.debugMode && this.debugInfo) {
        this.debugInfo.columnAnalysis.mappingReasons[header] = mappingReason;
      }
    });

    return mappings;
  }

  private createEventFromRowData(
    cellData: string[], 
    headers: string[], 
    columnMappings: NotionColumnMapping, 
    sourceUrl: string, 
    rowIndex: number
  ): NotionScrapedEvent | null {
    const eventData: Partial<NotionScrapedEvent> = {
      id: `scraped_${Date.now()}_${rowIndex}`,
      sourceUrl,
      scrapedAt: new Date(),
      calendarId: this.extractCalendarIdFromUrl(sourceUrl),
      properties: {},
      customProperties: {}
    };

    // Process each cell according to column mapping
    for (let i = 0; i < Math.min(cellData.length, headers.length); i++) {
      const cellValue = cellData[i];
      const header = headers[i];
      const mapping = columnMappings[header];

      if (!mapping || !cellValue) continue;

      switch (mapping.type) {
        case 'date': {
          const parsedDate = this.parseEnhancedDate(cellValue);
          if (parsedDate) {
            eventData.date = parsedDate.date;
            if (parsedDate.time) eventData.time = parsedDate.time;
            if (parsedDate.endDate) {
              eventData.dateRange = {
                startDate: parsedDate.date,
                endDate: parsedDate.endDate
              };
            }
          }
          break;
        }
        case 'title':
          eventData.title = cellValue;
          break;
        case 'status':
          eventData.status = cellValue.toLowerCase();
          break;
        case 'location':
          eventData.location = cellValue;
          break;
        case 'category':
          eventData.categories = cellValue.split(',').map(cat => cat.trim());
          break;
        case 'description':
          eventData.description = cellValue;
          break;
        case 'time':
          if (!eventData.time) eventData.time = cellValue;
          break;
        case 'priority':
          eventData.priority = cellValue.toLowerCase();
          break;
        case 'custom':
          eventData.customProperties![mapping.propertyName] = cellValue;
          break;
      }

      // Store original property
      eventData.properties![header] = cellValue;
    }

    // Validate required fields
    if (!eventData.date || !eventData.title) {
  // debug removed: skipping invalid row
      return null;
    }

    // Set defaults
    eventData.time = eventData.time || 'All day';
    eventData.description = eventData.description || '';
    eventData.location = eventData.location || '';
    eventData.categories = eventData.categories || [];

    return eventData as NotionScrapedEvent;
  }

  private parseEnhancedDate(dateText: string): { date: Date; time?: string; endDate?: Date } | null {
    // Enhanced date parsing for various formats
    const datePatterns = [
      // ISO format: 2024-01-15
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      // US format: 01/15/2024 or 1/15/2024
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // European format: 15.01.2024
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // Long format: January 15, 2024
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
      // Short format: Jan 15, 2024
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
    ];

    // Time pattern
    const timePattern = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/;

    for (const pattern of datePatterns) {
      const match = dateText.match(pattern);
      if (match) {
        let date: Date;
        
        if (pattern.source.includes('January|February')) {
          // Month name format
          const monthIndex = this.getMonthIndex(match[1]);
          const day = parseInt(match[2]);
          const year = parseInt(match[3]);
          date = new Date(year, monthIndex, day);
        } else if (pattern.source.includes('Jan|Feb')) {
          // Short month format
          const monthIndex = this.getMonthIndex(match[1]);
          const day = parseInt(match[2]);
          const year = parseInt(match[3]);
          date = new Date(year, monthIndex, day);
        } else if (pattern.source.includes('(\\d{4})')) {
          // Year-first format (ISO)
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          date = new Date(year, month, day);
        } else {
          // Month-first or day-first format
          const part1 = parseInt(match[1]);
          const part2 = parseInt(match[2]);
          const year = parseInt(match[3]);
          
          // Assume US format (MM/DD/YYYY) by default
          date = new Date(year, part1 - 1, part2);
        }

        if (isNaN(date.getTime())) continue;

        // Extract time if present
        const timeMatch = dateText.match(timePattern);
        const time = timeMatch ? timeMatch[0] : undefined;

        return { date, time };
      }
    }

    return null;
  }

  // Column type detection methods
  private isDateColumn(header: string): boolean {
    return /^(date|when|day|time|schedule|due|start|end)/.test(header);
  }

  private isTitleColumn(header: string): boolean {
    return /^(title|name|event|task|subject|what)/.test(header);
  }

  private isStatusColumn(header: string): boolean {
    return /^(status|state|done|complete|progress)/.test(header);
  }

  private isLocationColumn(header: string): boolean {
    return /^(location|where|place|venue|address)/.test(header);
  }

  private isCategoryColumn(header: string): boolean {
    return /^(category|type|tag|label|kind|group)/.test(header);
  }

  private isDescriptionColumn(header: string): boolean {
    return /^(description|details|notes|info|about)/.test(header);
  }

  private isTimeColumn(header: string): boolean {
    return /^(time|hour|when|at)$/.test(header);
  }

  private isPriorityColumn(header: string): boolean {
    return /^(priority|importance|urgent|level)/.test(header);
  }

  private getMonthIndex(monthName: string): number {
    const months: { [key: string]: number } = {
      'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
      'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5, 'july': 6, 'jul': 6,
      'august': 7, 'aug': 7, 'september': 8, 'sep': 8, 'october': 9, 'oct': 9,
      'november': 10, 'nov': 10, 'december': 11, 'dec': 11
    };
    return months[monthName.toLowerCase()] ?? -1;
  }

  private extractCalendarIdFromUrl(url: string): string {
    const urlParts = url.split('?')[0].split('/');
    const lastPart = urlParts[urlParts.length - 1];
    return lastPart.split('-').pop() || 'scraped_calendar';
  }
}

export const notionTableParser = new NotionTableParser();
