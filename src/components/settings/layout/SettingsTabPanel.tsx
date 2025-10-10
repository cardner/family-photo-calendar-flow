import React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import SettingsTabLayout, { SettingsTabLayoutProps } from './SettingsTabLayout';

export interface SettingsTabPanelProps
  extends React.ComponentProps<typeof TabsContent> {
  /**
   * Control the inner layout wrapper. Pass `false` to render children directly.
   */
  layout?: SettingsTabLayoutProps | false;
}

const SettingsTabPanel = React.forwardRef<HTMLDivElement, SettingsTabPanelProps>(
  ({ children, className, layout = {}, ...props }, ref) => {
    const content =
      layout === false ? children : (
        <SettingsTabLayout {...layout}>{children}</SettingsTabLayout>
      );

    return (
      <TabsContent
        ref={ref}
        className={cn('mt-0 focus-visible:outline-none', className)}
        {...props}
      >
        {content}
      </TabsContent>
    );
  }
);

SettingsTabPanel.displayName = 'SettingsTabPanel';

export default SettingsTabPanel;
