import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { checkForUpdates } from '@/utils/updateManager';
import { shouldCheckUpstream, setLastUpstreamCheckTime } from '@/utils/upstreamVersionManager';
import { toast } from '@/hooks/use-toast';
import { UpdateInfo, convertToUpdateInfo } from '@/types/update';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';
import { useSettingsModalController } from '@/contexts/settings/SettingsModalControllerContext';

const UpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const { openModal } = useSettingsModalController();

  useEffect(() => {
    const checkUpdates = async () => {
      // Only check if it's time to do so
      if (!shouldCheckUpstream()) {
        return;
      }

      try {
        const updateStatus = await checkForUpdates();
        
        if (updateStatus.isAvailable && updateStatus.updateInfo) {
          const convertedInfo = convertToUpdateInfo(updateStatus.updateInfo);
          setUpdateInfo(convertedInfo);
          setUpdateAvailable(true);
          
          toast({
            title: "Update Available",
            description: `Version ${updateStatus.latestVersion} is available from GitHub.`,
            variant: "default",
          });
        }
        
        setLastUpstreamCheckTime();
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // Check immediately and then periodically
    checkUpdates();
    
    const interval = setInterval(checkUpdates, 60 * 60 * 1000); // Check every hour
    
    return () => clearInterval(interval);
  }, []);

  const handleOpenSettings = () => {
    setUpdateAvailable(false);
    openModal('updates');
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    
    toast({
      title: "Update Dismissed",
      description: "You can check for updates later in Settings > Updates.",
      variant: "default",
    });
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <SettingsSectionCard
      className="fixed bottom-4 left-4 right-4 z-50 shadow-lg md:left-auto md:right-4 md:max-w-sm bg-white dark:bg-gray-900"
      contentClassName="p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-blue-500" />
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Update Available
            </h3>
            {updateInfo && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Version {updateInfo.version}
                <span className="block">
                  Released: {new Date(updateInfo.publishedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            A new version is available on GitHub. Go to Settings to install the update.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={handleOpenSettings} 
              size="sm" 
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              Open Settings
            </Button>
            <Button 
              onClick={handleDismiss} 
              variant="outline" 
              size="sm"
              className="border-gray-300 dark:border-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
};

export default UpdateNotification;
