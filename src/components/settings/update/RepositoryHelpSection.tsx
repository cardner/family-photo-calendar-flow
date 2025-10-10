
import React from 'react';
import { Info } from 'lucide-react';
import { InfoBanner, InfoBannerContent, InfoBannerDescription, InfoBannerIcon, InfoBannerTitle } from '@/components/ui/info-banner';

const RepositoryHelpSection = () => {
  return (
    <InfoBanner variant="info">
      <InfoBannerIcon>
        <Info className="h-4 w-4" />
      </InfoBannerIcon>
      <InfoBannerContent>
        <InfoBannerTitle variant="info">How to find repository information:</InfoBannerTitle>
        <InfoBannerDescription variant="info" className="space-y-1">
          <span className="block">1. Go to the GitHub repository page</span>
          <span className="block">2. The URL format is: github.com/[owner]/[repository-name]</span>
          <span className="block">3. Enter the owner and repository name in the fields above</span>
          <span className="block pt-2 font-medium">Example:</span>
          <span className="block">For https://github.com/microsoft/vscode:</span>
          <span className="block">• Owner: microsoft</span>
          <span className="block">• Repository: vscode</span>
        </InfoBannerDescription>
      </InfoBannerContent>
    </InfoBanner>
  );
};

export default RepositoryHelpSection;
