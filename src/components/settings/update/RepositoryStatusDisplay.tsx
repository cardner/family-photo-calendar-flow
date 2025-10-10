
import React from 'react';
import { Check, X, GitBranch } from 'lucide-react';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';

interface RepositoryStatusDisplayProps {
  currentRepo: string | null;
  validationStatus: 'idle' | 'valid' | 'invalid';
}

const RepositoryStatusDisplay = ({ currentRepo, validationStatus }: RepositoryStatusDisplayProps) => {
  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'valid':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <GitBranch className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!currentRepo) {
    return null;
  }

  return (
    <InfoBanner>
      <InfoBannerIcon>{getStatusIcon()}</InfoBannerIcon>
      <InfoBannerContent>
        <InfoBannerTitle>
          Current Repository: {currentRepo}
        </InfoBannerTitle>
        <InfoBannerDescription>
          Checking this repository for new releases
        </InfoBannerDescription>
      </InfoBannerContent>
    </InfoBanner>
  );
};

export default RepositoryStatusDisplay;
