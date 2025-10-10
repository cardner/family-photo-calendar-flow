
import React from 'react';
import LocalDataManager from '@/components/LocalDataManager';
import ICalSettings from './ICalSettings';
import NotionIntegration from './NotionIntegration';
import { useCalendarSelection } from '@/hooks/useCalendarSelection';

const CalendarsTab = () => {
  const { selectedCalendarIds, toggleCalendar } = useCalendarSelection();

  return (
    <>
      <LocalDataManager />
      <ICalSettings
        selectedCalendarIds={selectedCalendarIds}
        onToggleSelection={toggleCalendar}
      />
      <NotionIntegration
        selectedCalendarIds={selectedCalendarIds}
        onToggleSelection={toggleCalendar}
      />
    </>
  );
};

export default CalendarsTab;
