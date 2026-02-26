/**
 * Modal de informações do restaurante exibido no cardápio público.
 * Logo, nome, telefone, horário de funcionamento e descrição.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Phone, Clock, FileText, Instagram, CalendarClock } from 'lucide-react';
import { generateWhatsAppLink } from '@/lib/core/utils';
import type { Restaurant } from '@/types';
import type { DayKey } from '@/types';

const COUNTRY_CODES: Record<string, string> = { BR: '+55', PY: '+595', AR: '+54' };
const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_LABELS_PT: Record<DayKey, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};
const DAY_LABELS_ES: Record<DayKey, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

function formatTimeHHMM(hhmm: string): string {
  if (!hhmm || hhmm.length < 5) return hhmm;
  const [h, m] = hhmm.split(':');
  const hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  if (min === 0) return `${hour}h`;
  return `${hour}h${min.toString().padStart(2, '0')}`;
}

function formatOpeningHours(
  openingHours: Record<string, { open: string; close: string } | null> | undefined,
  alwaysOpen: boolean,
  lang: 'pt' | 'es'
): string {
  if (alwaysOpen) return lang === 'pt' ? 'Aberto 24 horas' : 'Abierto 24 horas';
  if (!openingHours || Object.keys(openingHours).length === 0) {
    return lang === 'pt' ? 'Horário não definido' : 'Horario no definido';
  }
  const labels = lang === 'es' ? DAY_LABELS_ES : DAY_LABELS_PT;
  const lines: string[] = [];
  for (const key of DAY_KEYS) {
    const slot = openingHours[key as keyof typeof openingHours];
    if (!slot?.open || !slot?.close) continue;
    const range = `${formatTimeHHMM(slot.open)} - ${formatTimeHHMM(slot.close)}`;
    lines.push(`${labels[key as DayKey]}: ${range}`);
  }
  return lines.length > 0 ? lines.join('\n') : (lang === 'pt' ? 'Horário não definido' : 'Horario no definido');
}

interface RestaurantInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: Restaurant | null;
}

function RestaurantInfoModal({ open, onOpenChange, restaurant }: RestaurantInfoModalProps) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const lang = (i18n.language === 'es' ? 'es' : 'pt') as 'pt' | 'es';
  const slug = restaurant?.slug ?? '';
  const base = slug && location.pathname.startsWith(`/${slug}`) ? `/${slug}` : '';

  if (!restaurant) return null;

  const country = (restaurant.phone_country as string) || 'BR';
  const prefix = COUNTRY_CODES[country] || '+55';
  const whatsapp = (restaurant.whatsapp || restaurant.phone || '').replace(/\D/g, '');
  const fullWhatsApp = whatsapp ? (whatsapp.startsWith('55') || whatsapp.startsWith('595') || whatsapp.startsWith('54') ? whatsapp : prefix.replace('+', '') + whatsapp) : '';
  const waLink = fullWhatsApp ? generateWhatsAppLink(fullWhatsApp, '') : null;

  const hoursText = formatOpeningHours(
    restaurant.opening_hours as Record<string, { open: string; close: string } | null> | undefined,
    !!restaurant.always_open,
    lang
  );

  const t = {
    contact: lang === 'pt' ? 'Contato' : 'Contacto',
    hours: lang === 'pt' ? 'Horário de funcionamento' : 'Horario de funcionamiento',
    description: lang === 'pt' ? 'Sobre o estabelecimento' : 'Sobre el establecimiento',
  };

  const instagramRaw = restaurant.instagram_url?.trim();
  const instagramHref = instagramRaw?.startsWith('http') ? instagramRaw : instagramRaw ? `https://instagram.com/${instagramRaw.replace(/^@/, '')}` : null;
  const instagramHandle = instagramRaw ? instagramRaw.replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '').replace(/^@/, '').replace(/\/$/, '') || instagramRaw : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[400px] rounded-2xl p-0 overflow-hidden border border-border shadow-xl"
        hideClose={false}
      >
        <div className="bg-card">
          {/* Header: logo + nome */}
          <div className="p-5 sm:p-6 pb-4">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden ring-1 ring-border bg-muted flex-shrink-0">
                {restaurant.logo ? (
                  <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground font-bold text-2xl sm:text-3xl">
                    {restaurant.name.charAt(0)}
                  </div>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{restaurant.name}</h2>
            </div>
          </div>

          {/* Conteúdo: telefone, horário, descrição */}
          <div className="px-5 sm:px-6 pb-6 space-y-5">
            {/* Telefone */}
            {waLink && (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{t.contact}</p>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-primary hover:text-primary/90 hover:underline break-all"
                  >
                    {prefix} {restaurant.phone || restaurant.whatsapp || ''}
                  </a>
                </div>
              </div>
            )}

            {/* Instagram */}
            {instagramHref && instagramHandle && (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Instagram className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Instagram</p>
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-primary hover:text-primary/90 hover:underline break-all"
                  >
                    @{instagramHandle}
                  </a>
                </div>
              </div>
            )}

            {/* Horário */}
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{t.hours}</p>
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{hoursText}</p>
              </div>
            </div>

            {/* Reserva */}
            <div className="flex flex-col gap-2">
              <Link
                to={`${base}/reservar`}
                className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-colors font-medium text-sm shadow-sm"
                onClick={() => onOpenChange(false)}
              >
                <CalendarClock className="h-5 w-5 text-primary-foreground" />
                {lang === 'pt' ? 'Fazer reserva' : 'Hacer reserva'}
              </Link>
            </div>

            {/* Descrição */}
            {restaurant.description?.trim() && (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{t.description}</p>
                  <p className="text-sm text-foreground leading-relaxed">{restaurant.description.trim()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(RestaurantInfoModal);
