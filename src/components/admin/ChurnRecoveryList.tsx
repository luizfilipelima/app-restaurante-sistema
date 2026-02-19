import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, type CurrencyCode } from '@/lib/utils';
import type { DashboardRetentionRiskItem } from '@/types/dashboard-analytics';

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.startsWith('55') ? digits : `55${digits}`;
  }
  return digits;
}

function buildWhatsAppUrl(phone: string, nome: string): string {
  const text = encodeURIComponent(
    `Olá ${nome?.trim() || 'Cliente'}! Que saudades. Aqui tens um desconto especial para pedires hoje!`
  );
  return `https://wa.me/${phone}?text=${text}`;
}

interface ChurnRecoveryListProps {
  clients: DashboardRetentionRiskItem[];
  currency?: CurrencyCode;
}

export function ChurnRecoveryList({ clients, currency = 'BRL' }: ChurnRecoveryListProps) {
  if (!clients?.length) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>Nenhum cliente em risco de churn no momento</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {clients.map((client) => {
        const phone = normalizePhone(client.telefone);
        const hasPhone = phone.length >= 10;
        const nome = client.nome?.trim() || 'Cliente';

        return (
          <li
            key={`${client.telefone}-${client.nome}`}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate" title={nome}>
                {nome}
              </p>
              <p className="text-sm text-slate-500">
                Total gasto: {formatCurrency(Number(client.total_gasto), currency)}
              </p>
            </div>
            {hasPhone ? (
              <Button
                size="sm"
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                asChild
              >
                <a
                  href={buildWhatsAppUrl(phone, nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Recuperar (WhatsApp)
                </a>
              </Button>
            ) : (
              <Button
                size="sm"
                className="shrink-0"
                disabled
                variant="outline"
              >
                <MessageCircle className="h-4 w-4" />
                Recuperar (WhatsApp)
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
