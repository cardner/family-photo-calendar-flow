
/**
 * Version Manager - Upstream Release Focused
 * 
 * Manages application version based on installed GitHub releases only.
 * Tracks the currently installed release version and compares against upstream.
 */

const INSTALLED_VERSION_KEY = 'installed_release_version';
const INSTALL_DATE_KEY = 'installed_release_date';
const STORED_VERSION_KEY = 'stored_app_version';

export interface InstalledVersionInfo {
  version: string;
  installDate: string;
  releaseUrl?: string;
  releaseNotes?: string;
}

export interface VersionInfo {
  version: string;
  buildDate?: string;
  gitHash?: string;
  buildNumber?: number;
  environment?: string;
}

/**
 * Get the currently installed release version
 */
export const getInstalledVersion = (): InstalledVersionInfo | null => {
  try {
    const version = localStorage.getItem(INSTALLED_VERSION_KEY);
    const installDate = localStorage.getItem(INSTALL_DATE_KEY);
    
    if (!version) {
      // If no installed version is tracked, assume this is the initial version
      return {
        version: '1.4.2', // From current version.json as baseline
        installDate: new Date().toISOString()
      };
    }
    
    return {
      version,
      installDate: installDate || new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get installed version:', error);
    return {
      version: '1.4.2',
      installDate: new Date().toISOString()
    };
  }
};

/**
 * Set the installed version after successful update
 */
export const setInstalledVersion = (versionInfo: Partial<InstalledVersionInfo>) => {
  try {
    localStorage.setItem(INSTALLED_VERSION_KEY, versionInfo.version!);
    localStorage.setItem(INSTALL_DATE_KEY, versionInfo.installDate || new Date().toISOString());
    
    if (versionInfo.releaseUrl) {
      localStorage.setItem('installed_release_url', versionInfo.releaseUrl);
    }
    if (versionInfo.releaseNotes) {
      localStorage.setItem('installed_release_notes', versionInfo.releaseNotes);
    }
  } catch (error) {
    console.error('Failed to set installed version:', error);
  }
};

/**
 * Get current version from version.json file
 */
export const getCurrentVersion = async (): Promise<string> => {
  try {
    const response = await fetch('/version.json');
    if (!response.ok) {
      throw new Error('Failed to load version.json');
    }
    const versionData = await response.json();
    return versionData.version || '1.4.2';
  } catch (error) {
    console.error('Failed to get current version:', error);
    return '1.4.2';
  }
};

/**
 * Get stored version from localStorage
 */
export const getStoredVersion = (): string | null => {
  try {
    return localStorage.getItem(STORED_VERSION_KEY);
  } catch (error) {
    console.error('Failed to get stored version:', error);
    return null;
  }
};

/**
 * Set stored version in localStorage
 */
export const setStoredVersion = (version: string): void => {
  try {
    localStorage.setItem(STORED_VERSION_KEY, version);
  } catch (error) {
    console.error('Failed to set stored version:', error);
  }
};

/**
 * Get comprehensive version information
 */
export const getVersionInfo = async (): Promise<VersionInfo | null> => {
  try {
    const response = await fetch('/version.json');
    if (!response.ok) {
      throw new Error('Failed to load version.json');
    }
    const versionData = await response.json();
    return {
      version: versionData.version || '1.4.2',
      buildDate: versionData.buildDate,
      gitHash: versionData.gitHash,
      buildNumber: versionData.buildNumber,
      environment: versionData.environment
    };
  } catch (error) {
    console.error('Failed to get version info:', error);
    return {
      version: '1.4.2'
    };
  }
};

/**
 * Compare two semantic versions
 */
export const compareVersions = (version1: string, version2: string): number => {
  const v1parts = version1.replace(/^v/, '').split('.').map(Number);
  const v2parts = version2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  
  return 0;
};

/**
 * Check if an update is available by comparing installed vs upstream version
 */
export const isUpdateAvailable = (upstreamVersion: string): boolean => {
  const installed = getInstalledVersion();
  if (!installed) return true;
  
  return compareVersions(upstreamVersion, installed.version) > 0;
};

/**
 * Get version type for update (major, minor, patch)
 */
export const getVersionType = (oldVersion: string, newVersion: string): 'major' | 'minor' | 'patch' => {
  const oldParts = oldVersion.replace(/^v/, '').split('.').map(Number);
  const newParts = newVersion.replace(/^v/, '').split('.').map(Number);
  
  if (newParts[0] > oldParts[0]) return 'major';
  if (newParts[1] > oldParts[1]) return 'minor';
  return 'patch';
};
