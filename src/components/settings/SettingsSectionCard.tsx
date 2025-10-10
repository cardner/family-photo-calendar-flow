import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SettingsSectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  contentClassName?: string;
}

const SettingsSectionCard = React.forwardRef<HTMLDivElement, SettingsSectionCardProps>(
  (
    {
  heading,
      description,
      icon,
      actions,
      children,
      className,
      contentClassName,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        className={cn(
          'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          className
        )}
        {...props}
      >
        <CardContent className={cn('p-4 space-y-3', contentClassName)}>
          {(heading || description || icon || actions) && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {icon && <div className="mt-0.5 text-gray-600 dark:text-gray-400">{icon}</div>}
                <div>
                  {heading && (
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {heading}
                    </h4>
                  )}
                  {description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
                  )}
                </div>
              </div>
              {actions && <div className="flex-shrink-0">{actions}</div>}
            </div>
          )}
          {children}
        </CardContent>
      </Card>
    );
  }
);

SettingsSectionCard.displayName = 'SettingsSectionCard';

export default SettingsSectionCard;
