
import React from 'react';
import NotionScrapedSettings from './NotionScrapedSettings';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';

interface NotionIntegrationProps {
  selectedCalendarIds?: string[];
  onToggleSelection?: (calendarId: string, selected: boolean) => void;
}

const NotionIntegration = ({ 
  selectedCalendarIds: propSelectedCalendarIds, 
  onToggleSelection: propOnToggleSelection 
}: NotionIntegrationProps = {}) => {
  const { 
    selectedCalendarIds: hookSelectedCalendarIds, 
    toggleCalendar: hookToggleCalendar,
    scrapedEvents 
  } = useCalendarSelection();

  // Use props if provided, otherwise use hook values
  const selectedCalendarIds = propSelectedCalendarIds || hookSelectedCalendarIds;
  const toggleCalendar = propOnToggleSelection || hookToggleCalendar;


  return (
    <div className="space-y-6">
      {/* Notion API Integration */}
      <div>
        <h3 className="text-lg font-medium mb-2">Notion API Integration</h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect directly to Notion databases using the API for automatic syncing
        </p>
        <NotionScrapedSettings 
          selectedCalendarIds={selectedCalendarIds}
          onToggleSelection={toggleCalendar}
        />
      </div>

      {/* Integration Stats */}
      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Integration Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">API Events:</span>
            <span className="ml-2 font-medium">{scrapedEvents.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Selected Calendars:</span>
            <span className="ml-2 font-medium">{selectedCalendarIds.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotionIntegration;
