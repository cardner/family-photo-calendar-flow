import React, { useCallback, useMemo, useState } from 'react';

import {
  SettingsModalControllerContext,
  type SettingsModalControllerValue,
  type SettingsTabId,
} from './SettingsModalControllerContext';

export const SettingsModalControllerProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<SettingsTabId>('calendars');

  const openModal = useCallback<SettingsModalControllerValue['openModal']>((tab) => {
    if (tab) {
      setActiveTabState(tab);
    }
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setActiveTab = useCallback<SettingsModalControllerValue['setActiveTab']>((tab) => {
    setActiveTabState(tab);
  }, []);

  const value = useMemo<SettingsModalControllerValue>(
    () => ({
      isOpen,
      activeTab,
      openModal,
      closeModal,
      setActiveTab,
    }),
    [isOpen, activeTab, openModal, closeModal, setActiveTab]
  );

  return (
    <SettingsModalControllerContext.Provider value={value}>
      {children}
    </SettingsModalControllerContext.Provider>
  );
};
