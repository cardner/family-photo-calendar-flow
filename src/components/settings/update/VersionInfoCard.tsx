
import React from 'react';
import { Info, Clock } from 'lucide-react';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface VersionInfoCardProps {
  currentVersion: string;
  lastCheckTime: Date | null;
}

const VersionInfoCard = ({ currentVersion, lastCheckTime }: VersionInfoCardProps) => {
  const formatLastCheckTime = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Installed Version
        </span>
      )}
      description="Current version installed on this device"
      contentClassName="space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Installed Version:</span>
        <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-gray-100">
          v{currentVersion}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Check:</span>
        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {formatLastCheckTime(lastCheckTime)}
        </span>
      </div>
    </SettingsSectionCard>
  );
};

export default VersionInfoCard;
