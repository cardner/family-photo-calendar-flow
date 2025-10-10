
import React from 'react';
import { BarChart3 } from 'lucide-react';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';

interface EventSummaryProps {
  totalEvents: number;
  calendarsWithEventsCount: number;
  selectedCalendarsCount: number;
}

const EventSummary = ({ totalEvents, calendarsWithEventsCount, selectedCalendarsCount }: EventSummaryProps) => {
  if (totalEvents === 0) return null;

  return (
    <InfoBanner variant="info">
      <InfoBannerIcon>
        <BarChart3 className="h-5 w-5" />
      </InfoBannerIcon>
      <InfoBannerContent>
        <InfoBannerTitle variant="info">Event summary</InfoBannerTitle>
        <InfoBannerDescription variant="info" className="grid grid-cols-3 gap-4 text-sm">
          <span>
            <span className="font-medium text-blue-900 dark:text-blue-100 block">{totalEvents}</span>
            <span className="text-blue-700 dark:text-blue-300">Total events</span>
          </span>
          <span>
            <span className="font-medium text-blue-900 dark:text-blue-100 block">{calendarsWithEventsCount}</span>
            <span className="text-blue-700 dark:text-blue-300">Active calendars</span>
          </span>
          <span>
            <span className="font-medium text-blue-900 dark:text-blue-100 block">{selectedCalendarsCount}</span>
            <span className="text-blue-700 dark:text-blue-300">Selected</span>
          </span>
        </InfoBannerDescription>
      </InfoBannerContent>
    </InfoBanner>
  );
};

export default EventSummary;
