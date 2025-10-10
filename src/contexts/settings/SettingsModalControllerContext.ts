import { createContext, useContext } from 'react';

export type SettingsTabId =
  | 'calendars'
  | 'photos'
  | 'display'
  | 'weather'
  | 'updates'
  | 'security'
  | 'logs';

export interface SettingsModalControllerValue {
  isOpen: boolean;
  activeTab: SettingsTabId;
  openModal: (tab?: SettingsTabId) => void;
  closeModal: () => void;
  setActiveTab: (tab: SettingsTabId) => void;
}

export const SettingsModalControllerContext = createContext<
  SettingsModalControllerValue | undefined
>(undefined);

export const useSettingsModalController = (): SettingsModalControllerValue => {
  const context = useContext(SettingsModalControllerContext);
  if (!context) {
    throw new Error(
      'useSettingsModalController must be used within a SettingsModalControllerProvider'
    );
  }
  return context;
};
