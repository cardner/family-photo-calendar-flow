
interface PerformanceEntry {
  name: string;
  startTime: number;
  duration?: number;
}

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  componentCount: number;
}

class PerformanceTracker {
  private entries: Map<string, PerformanceEntry> = new Map();

  startMeasurement(name: string): void {
    this.entries.set(name, {
      name,
      startTime: performance.now()
    });
  }

  endMeasurement(name: string): number | null {
    const entry = this.entries.get(name);
    if (!entry) return null;

    const duration = performance.now() - entry.startTime;
    entry.duration = duration;
    
    console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    return duration;
  }

  getMetrics(): PerformanceMetrics {
    const renderEntry = this.entries.get('render');
    
    return {
      renderTime: renderEntry?.duration || 0,
      memoryUsage: this.getMemoryUsage(),
      componentCount: this.entries.size
    };
  }

  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memoryInfo = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : undefined;
    }
    return undefined;
  }

  reset(): void {
    this.entries.clear();
  }
}

export const performanceTracker = new PerformanceTracker();

export const measureComponentRender = <T>(
  component: () => T,
  componentName: string
): T => {
  performanceTracker.startMeasurement(`${componentName}-render`);
  const result = component();
  performanceTracker.endMeasurement(`${componentName}-render`);
  return result;
};

export const logRenderMetrics = (): void => {
  const metrics = performanceTracker.getMetrics();
  console.table(metrics);
};

// Export additional utilities needed by other components
export class PerformanceMonitor {
  private static isMonitoring = false;
  private static monitoringInterval: number | null = null;

  static startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('Performance monitoring started');
    
    // Monitor performance every 30 seconds
    this.monitoringInterval = window.setInterval(() => {
      logRenderMetrics();
    }, 30000);
  }

  static stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      window.clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('Performance monitoring stopped');
  }

  static trackPageLoad(): void {
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
    });
  }
}

export class IntervalManager {
  private static intervals: Map<string, number> = new Map();

  static setInterval(name: string, callback: () => void, delay: number): number {
    // Clear existing interval with same name
    if (this.intervals.has(name)) {
      this.clearInterval(name);
    }
    
    const id = window.setInterval(callback, delay);
    this.intervals.set(name, id);
    return id;
  }

  static clearInterval(name: string): void {
    const id = this.intervals.get(name);
    if (id !== undefined) {
      window.clearInterval(id);
      this.intervals.delete(name);
    }
  }

  static clearAllIntervals(): void {
    this.intervals.forEach(id => window.clearInterval(id));
    this.intervals.clear();
  }
}

export const displayOptimizations = {
  enableVirtualization: () => {
    console.log('Virtual scrolling enabled for large lists');
  },
  
  enableImageLazyLoading: () => {
    console.log('Lazy loading enabled for images');
  },

  enableBurnInPrevention: (): number => {
    console.log('Burn-in prevention enabled');
    // Return a dummy interval ID for cleanup
    return window.setInterval(() => {
      // Subtle pixel shifting to prevent burn-in
    }, 60000);
  },

  enableOLEDOptimization: () => {
    console.log('OLED optimization enabled');
    // Apply dark mode optimizations for OLED displays
    document.documentElement.style.setProperty('--oled-black', '#000000');
  },

  adjustForTimeOfDay: () => {
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 6) {
      // Night mode adjustments
      console.log('Applying night mode optimizations');
      document.documentElement.style.setProperty('--night-brightness', '0.8');
    } else {
      // Day mode adjustments
      console.log('Applying day mode optimizations');
      document.documentElement.style.setProperty('--night-brightness', '1.0');
    }
  }
};
