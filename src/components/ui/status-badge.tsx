import * as React from 'react';
import {
  Clock,
  Package,
  CheckCircle2,
  Truck,
  X,
  Utensils,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'pending'
  | 'preparing'
  | 'delivering'
  | 'completed'
  | 'cancelled';

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  variant: BadgeVariant;
}

const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  [OrderStatus.PENDING]: {
    label: 'Pendente',
    icon: Clock,
    variant: 'pending',
  },
  [OrderStatus.PREPARING]: {
    label: 'Em Preparo',
    icon: Package,
    variant: 'preparing',
  },
  [OrderStatus.READY]: {
    label: 'Pronto',
    icon: Utensils,
    variant: 'info',
  },
  [OrderStatus.DELIVERING]: {
    label: 'Em Entrega',
    icon: Truck,
    variant: 'delivering',
  },
  [OrderStatus.COMPLETED]: {
    label: 'Concluído',
    icon: CheckCircle2,
    variant: 'completed',
  },
  [OrderStatus.CANCELLED]: {
    label: 'Cancelado',
    icon: X,
    variant: 'cancelled',
  },
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
  showIcon?: boolean;
}

const StatusBadge = ({ status, className, showIcon = true }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn('gap-1', className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
};

StatusBadge.displayName = 'StatusBadge';

export { StatusBadge, STATUS_CONFIG };
export type { StatusBadgeProps };
