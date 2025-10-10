
import React from 'react';
import { UpdateInfo } from '@/types/ical';
import { FileText } from 'lucide-react';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface ReleaseNotesDisplayProps {
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
}

const ReleaseNotesDisplay = ({ updateAvailable, updateInfo }: ReleaseNotesDisplayProps) => {
  if (!updateAvailable || !updateInfo?.releaseNotes) {
    return null;
  }

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Release Notes
        </span>
      )}
      description={`What's new in version ${updateInfo.version}`}
      contentClassName="space-y-2"
    >
      <div className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap max-h-40 overflow-y-auto bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-3">
        {updateInfo.releaseNotes}
      </div>
    </SettingsSectionCard>
  );
};

export default ReleaseNotesDisplay;
