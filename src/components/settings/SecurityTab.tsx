
import React from 'react';
import { Shield } from 'lucide-react';
import { useSecurity } from '@/contexts/security/SecurityContext';
import SecurityUnlockBanner from '@/components/security/SecurityUnlockBanner';
import SecurityStatusDisplay from './security/SecurityStatusDisplay';
import SecurityEnableForm from './security/SecurityEnableForm';
import SecurityUnlockForm from './security/SecurityUnlockForm';
import SecurityDisableSection from './security/SecurityDisableSection';
import SettingsSectionCard from '@/components/settings/SettingsSectionCard';

const SecurityTab = () => {
  const { 
    isSecurityEnabled, 
    hasLockedData, 
    enableSecurity, 
    disableSecurity, 
    getSecurityStatus 
  } = useSecurity();

  const hasSecuritySalt = localStorage.getItem('security_salt') !== null;
  const needsUnlock = hasSecuritySalt && !isSecurityEnabled;

  return (
    <SettingsSectionCard
      heading={(
        <span className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Settings
        </span>
      )}
      description={needsUnlock
        ? 'Enter your password to unlock encrypted data'
        : 'Configure client-side encryption for your sensitive data'}
      contentClassName="space-y-4"
    >
      <SecurityUnlockBanner />

      <SecurityStatusDisplay
        isSecurityEnabled={isSecurityEnabled}
        hasLockedData={hasLockedData}
        getSecurityStatus={getSecurityStatus}
      />

      {needsUnlock ? (
        <SecurityUnlockForm onUnlock={enableSecurity} />
      ) : isSecurityEnabled ? (
        <SecurityDisableSection onDisableSecurity={disableSecurity} />
      ) : (
        <SecurityEnableForm onEnableSecurity={enableSecurity} />
      )}
    </SettingsSectionCard>
  );
};

export default SecurityTab;
