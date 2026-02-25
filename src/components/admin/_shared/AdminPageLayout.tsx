/**
 * Wrapper padrão do conteúdo de cada página do painel admin.
 * Garante o mesmo espaçamento vertical (space-y-6) e largura em todas as telas.
 * Usar como raiz do conteúdo de cada página, envolvendo AdminPageHeader e o restante.
 */

import * as React from 'react';
import { cn } from '@/lib/core/utils';

export interface AdminPageLayoutProps {
  children: React.ReactNode;
  /** Classes adicionais (ex.: pb-8, pb-10 para páginas com mais conteúdo) */
  className?: string;
}

const AdminPageLayout = ({ children, className }: AdminPageLayoutProps) => {
  return (
    <div
      className={cn(
        'min-w-0 w-full space-y-6',
        className
      )}
    >
      {children}
    </div>
  );
};

AdminPageLayout.displayName = 'AdminPageLayout';

export { AdminPageLayout };
