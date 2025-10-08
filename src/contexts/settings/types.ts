
/**
 * Settings Context Types
 * 
 * Type definitions for all application settings and context interfaces.
 */

export interface SettingsContextType {
  // Display Settings
  /** Current theme preference (light/dark/system) */
  theme: 'light' | 'dark' | 'system';
  /** Update theme setting and apply immediately */
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  /** Default calendar view on app load */
  defaultView: 'month' | 'week' | 'timeline';
  /** Update default view preference */
  setDefaultView: (view: 'month' | 'week' | 'timeline') => void;
  /** Whether to keep screen awake when app is visible */
  keepScreenAwake: boolean;
  /** Update screen wake lock preference */
  setKeepScreenAwake: (enabled: boolean) => void;
  
  // Weather Settings (Sensitive - encrypted when possible)
  /** User's coordinates for weather location */
  coordinates: string;
  /** Update coordinates with validation */
  setCoordinates: (coordinates: string) => void;
  
  // Photo Settings (Sensitive - encrypted when possible)
  /** Google Photos public album URL */
  publicAlbumUrl: string;
  /** Update album URL with validation */
  setPublicAlbumUrl: (url: string) => void;
  
  // GitHub Settings (Sensitive - encrypted when possible)
  /** GitHub repository owner/username */
  githubOwner: string;
  /** Update GitHub owner with validation */
  setGithubOwner: (owner: string) => void;
  /** GitHub repository name */
  githubRepo: string;
  /** Update GitHub repo with validation */
  setGithubRepo: (repo: string) => void;
  
  // Notion Settings (Sensitive - encrypted when possible)
  /** Notion integration token */
  notionToken: string;
  /** Update Notion token with validation */
  setNotionToken: (token: string) => void;
  /** Notion database ID for calendar events */
  notionDatabaseId: string;
  /** Update Notion database ID with validation */
  setNotionDatabaseId: (databaseId: string) => void;
  
  // Background Settings
  /** Photo background rotation duration in minutes */
  backgroundDuration: number;
  /** Update background rotation timing */
  setBackgroundDuration: (duration: number) => void;
  /** Currently selected photo album ID */
  selectedAlbum: string | null;
  /** Update selected album */
  setSelectedAlbum: (albumId: string | null) => void;
}
