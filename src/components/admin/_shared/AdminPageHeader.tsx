/**
 * Header padrão de página do painel admin.
 * Garante título, descrição, ícone opcional e ações com o mesmo visual em todas as telas.
 * Usar em todas as páginas do painel para identidade visual coesa.
 */

import * as React from 'react';
import { cn } from '@/lib/core/utils';
import type { LucideIcon } from 'lucide-react';

export interface AdminPageHeaderProps {
  /** Título da página (obrigatório) */
  title: string;
  /** Descrição ou subtítulo (opcional) */
  description?: React.ReactNode;
  /** Ícone ao lado do título (opcional) — tamanho e cor padronizados */
  icon?: LucideIcon;
  /** Ações (botões, filtros etc.) alinhadas à direita no desktop */
  actions?: React.ReactNode;
  className?: string;
}

const AdminPageHeader = ({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: AdminPageHeaderProps) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="admin-page-title flex items-center gap-2">
          {Icon && (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center text-primary"
              aria-hidden
            >
              <Icon className="h-6 w-6" />
            </span>
          )}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {description != null && (
          <p className="admin-page-description">{description}</p>
        )}
      </div>
      {actions != null && actions !== false && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
};

AdminPageHeader.displayName = 'AdminPageHeader';

export { AdminPageHeader };
