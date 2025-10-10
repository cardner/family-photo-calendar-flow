
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, HardDrive, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { localDataManager } from '@/utils/localDataManager';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';
import { Progress } from '@/components/ui/progress';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

const LocalDataManager = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      await localDataManager.exportAllData();
      toast({
        title: "Data exported",
        description: "Your calendar data and settings have been downloaded as a backup file.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export your data and settings. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await localDataManager.importAllData(file);
      toast({
        title: "Data imported",
        description: "Your calendar data and settings have been restored from the backup file.",
      });
      // Reload the page to reflect imported data
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import data.",
        variant: "destructive"
      });
    }
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all calendar data and settings? This action cannot be undone.')) {
      await localDataManager.clearAllData();
      toast({
        title: "Data cleared",
        description: "All calendar data and settings have been removed.",
      });
      // Reload the page to reflect cleared data
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const storageUsage = localDataManager.getStorageUsage();
  const usagePercentage = (storageUsage.used / storageUsage.total) * 100;

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Local Data Management
        </span>
      )}
      description="Backup, restore, and manage your local calendar data and settings using tiered storage"
      contentClassName="space-y-4"
    >
        {/* Storage Usage */}
        <InfoBanner className="flex-col sm:flex-row items-stretch sm:items-center" variant="muted">
          <InfoBannerIcon
            asChild={false}
            className="mt-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            <HardDrive className="h-4 w-4" />
          </InfoBannerIcon>
          <InfoBannerContent className="flex-1 space-y-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <InfoBannerTitle>Storage usage</InfoBannerTitle>
              <InfoBannerDescription>
                {(storageUsage.used / 1024).toFixed(1)} KB of {(storageUsage.total / 1024 / 1024).toFixed(1)} MB
              </InfoBannerDescription>
            </div>
            <Progress value={Math.min(usagePercentage, 100)} className="h-2" />
          </InfoBannerContent>
        </InfoBanner>

        {/* Data Management Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex items-center gap-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Download className="h-4 w-4" />
            Export Backup
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="flex items-center gap-2 bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-green-300 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
          >
            <Upload className="h-4 w-4" />
            Import Backup
          </Button>

          <Button
            onClick={handleClearData}
            variant="outline"
            className="flex items-center gap-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Data
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />

        <InfoBanner variant="info">
          <InfoBannerIcon>
            <Info className="h-4 w-4" />
          </InfoBannerIcon>
          <InfoBannerContent>
            <InfoBannerTitle variant="info">Backup tip</InfoBannerTitle>
            <InfoBannerDescription variant="info">
              Your calendar data and settings use tiered storage (cache → localStorage → IndexedDB). Regular backups help prevent data loss.
            </InfoBannerDescription>
          </InfoBannerContent>
        </InfoBanner>
    </SettingsSectionCard>
  );
};

export default LocalDataManager;
