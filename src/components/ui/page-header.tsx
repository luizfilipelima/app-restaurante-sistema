import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-foreground truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 mt-3 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
};

PageHeader.displayName = 'PageHeader';

export { PageHeader };
export type { PageHeaderProps };
