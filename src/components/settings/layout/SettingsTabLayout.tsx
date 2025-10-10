import React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsTabLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Controls background and frame styling around the tab body.
   * - `default`: Transparent background, primarily for nested section cards.
   * - `surface`: Subtle elevated surface with border and padding.
   */
  variant?: 'default' | 'surface';
  /**
   * Apply negative margins so the surface can bleed to the container edges.
   * Useful for tabs that want a full-width muted background.
   */
  bleed?: boolean;
  /**
   * Stretch the layout to fill the available height so the background carries through.
   */
  fullHeight?: boolean;
}

const SettingsTabLayout = React.forwardRef<HTMLDivElement, SettingsTabLayoutProps>(
  (
    {
      children,
      className,
      variant = 'default',
      bleed = false,
      fullHeight = false,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'space-y-6',
          fullHeight && 'min-h-full',
          variant === 'surface' &&
            'rounded-xl border border-gray-200/80 bg-gray-50 dark:border-gray-800/60 dark:bg-gray-900/60 p-4 sm:p-6',
          bleed && '-m-1 sm:-m-2 lg:-m-3',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SettingsTabLayout.displayName = 'SettingsTabLayout';

export default SettingsTabLayout;
