
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';

const UpdateInfoSection = () => {
  return (
    <InfoBanner variant="info">
      <InfoBannerIcon>
        <AlertCircle className="h-4 w-4" />
      </InfoBannerIcon>
      <InfoBannerContent>
        <InfoBannerTitle variant="info">Manual Update System:</InfoBannerTitle>
        <InfoBannerDescription variant="info" className="space-y-1">
          <span className="block">• Updates are checked against the configured GitHub repository</span>
          <span className="block">• You control when to install updates by clicking the update button</span>
          <span className="block">• Configure the GitHub repository above to enable update checking</span>
          <span className="block">• The page will refresh automatically after successful updates</span>
        </InfoBannerDescription>
      </InfoBannerContent>
    </InfoBanner>
  );
};

export default UpdateInfoSection;
