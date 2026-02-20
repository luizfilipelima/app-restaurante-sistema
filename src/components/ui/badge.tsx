import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-transparent bg-success text-success-foreground hover:bg-success/80',
        warning:
          'border-transparent bg-warning text-warning-foreground hover:bg-warning/80',
        info:
          'border-transparent bg-info text-info-foreground hover:bg-info/80',
        pending:
          'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200',
        preparing:
          'border-transparent bg-amber-100 text-amber-700 hover:bg-amber-200',
        delivering:
          'border-transparent bg-blue-100 text-blue-700 hover:bg-blue-200',
        completed:
          'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
        cancelled:
          'border-transparent bg-red-100 text-red-700 hover:bg-red-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
