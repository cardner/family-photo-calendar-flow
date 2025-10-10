
import React from 'react';
import { Button } from '@/components/ui/button';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import { GitBranch, Download, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { UpdateInfo } from '@/types/update';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

interface UpdateStatusCardProps {
  updateAvailable: boolean;
  updateInfo: UpdateInfo;
  isChecking: boolean;
  isUpdating: boolean;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
  onOpenReleaseNotes: () => void;
}

const UpdateStatusCard = ({
  updateAvailable,
  updateInfo,
  isChecking,
  isUpdating,
  onCheckForUpdates,
  onInstallUpdate,
  onOpenReleaseNotes
}: UpdateStatusCardProps) => {
  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Update Status
        </span>
      )}
      description="Check for and install updates from GitHub releases"
      contentClassName="space-y-4"
    >
        {/* Status Display */}
        <InfoBanner variant={updateAvailable ? 'info' : 'success'}>
          <InfoBannerIcon>
            {updateAvailable ? (
              <Download className="h-5 w-5 text-blue-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant={updateAvailable ? 'info' : 'success'}>
              {updateAvailable ? 'Update Available' : 'Up to Date'}
            </InfoBannerTitle>
            {updateAvailable ? (
              updateInfo && (
                <InfoBannerDescription variant="info" className="space-y-0.5">
                  <span className="block">Version {updateInfo.version}</span>
                  <span className="block">Released: {new Date(updateInfo.publishedAt).toLocaleDateString()}</span>
                </InfoBannerDescription>
              )
            ) : (
              <InfoBannerDescription variant="success">
                You have the latest available version
              </InfoBannerDescription>
            )}
          </InfoBannerContent>
        </InfoBanner>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onCheckForUpdates}
            disabled={isChecking || isUpdating}
            variant="outline"
            className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Updates
              </>
            )}
          </Button>

          {updateAvailable && (
            <Button
              onClick={onInstallUpdate}
              disabled={isUpdating || isChecking}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isUpdating ? (
                <>
                  <Download className="h-4 w-4 mr-2 animate-pulse" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Update to v{updateInfo?.version}
                </>
              )}
            </Button>
          )}

          {updateAvailable && updateInfo && (
            <Button
              onClick={onOpenReleaseNotes}
              disabled={isChecking || isUpdating}
              variant="outline"
              className="border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Release Notes
            </Button>
          )}
        </div>
    </SettingsSectionCard>
  );
};

export default UpdateStatusCard;
