// Global ambient declarations and platform-specific augmentations
// Adds non-standard iOS Safari PWA property so we can feature-detect without any casts
interface Navigator {
  standalone?: boolean;
}

declare global {
  interface Window {
    __originalConsole?: {
      log: typeof console.log;
      info: typeof console.info;
      debug: typeof console.debug;
    };
    enableDebugLogs?: () => void;
    disableDebugLogs?: () => void;
  }
}
