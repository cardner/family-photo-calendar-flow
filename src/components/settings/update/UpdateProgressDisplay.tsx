
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { UpdateProgress } from '@/utils/manualUpdateManager';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface UpdateProgressDisplayProps {
  updateProgress: UpdateProgress | null;
  isUpdating: boolean;
}

const UpdateProgressDisplay = ({ updateProgress, isUpdating }: UpdateProgressDisplayProps) => {
  if (!isUpdating || !updateProgress) {
    return null;
  }

  const getProgressValue = () => {
    return updateProgress?.progress || 0;
  };

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
          Updating...
        </span>
      )}
      description="Downloading and installing the latest update"
      contentClassName="space-y-2"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {updateProgress.message}
        </span>
      </div>
      <Progress value={getProgressValue()} className="w-full" />
    </SettingsSectionCard>
  );
};

export default UpdateProgressDisplay;
