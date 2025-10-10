
import React from 'react';
import NotionScrapedSettings from './NotionScrapedSettings';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import { Calendar as CalendarIcon, Blocks } from 'lucide-react';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

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
      <SettingsSectionCard
        heading={(
          <span className="flex items-center gap-2">
            <Blocks className="h-5 w-5" />
            Notion API Integration
          </span>
        )}
        description="Connect directly to Notion databases using the API for automatic syncing"
        contentClassName="space-y-4"
      >
        <NotionScrapedSettings 
          selectedCalendarIds={selectedCalendarIds}
          onToggleSelection={toggleCalendar}
        />
      </SettingsSectionCard>

      {/* Integration Stats */}
      <InfoBanner variant="info">
        <InfoBannerIcon>
          <CalendarIcon className="h-5 w-5" />
        </InfoBannerIcon>
        <InfoBannerContent>
          <InfoBannerTitle variant="info">Integration summary</InfoBannerTitle>
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-900 dark:text-blue-100">
            <div>
              <span className="text-blue-700 dark:text-blue-200">API Events:</span>
              <span className="ml-2 font-medium">{scrapedEvents.length}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-200">Selected Calendars:</span>
              <span className="ml-2 font-medium">{selectedCalendarIds.length}</span>
            </div>
          </div>
        </InfoBannerContent>
      </InfoBanner>
    </div>
  );
};

export default NotionIntegration;
