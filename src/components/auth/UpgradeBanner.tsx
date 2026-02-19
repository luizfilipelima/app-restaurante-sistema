import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';

interface UpgradeBannerProps {
  /**
   * Flag técnica da feature bloqueada (ex: 'feature_bcg_matrix').
   * Passada via state na navegação para a página de planos.
   */
  featureFlag?: string;
  /** Rótulo amigável da funcionalidade bloqueada (ex: 'Matriz BCG'). */
  featureLabel?: string;
  /** Nome do plano necessário para desbloquear (ex: 'Enterprise'). */
  planRequired?: string;
  /** Descrição curta do que o usuário desbloquearia. */
  description?: string;
  /** Variant visual do banner: 'full' ocupa todo o espaço, 'inline' é compacto. */
  variant?: 'full' | 'inline';
}

/**
 * Banner de upgrade exibido como fallback quando uma feature está bloqueada.
 *
 * Usado principalmente como `fallback` prop do <FeatureGuard>, mas pode ser
 * inserido em qualquer lugar para comunicar que um recurso requer upgrade.
 *
 * Leva o usuário para /admin/upgrade com o featureFlag no state de navegação,
 * para que a página de planos exiba o contexto correto (qual feature estava bloqueada).
 */
export function UpgradeBanner({
  featureFlag,
  featureLabel,
  planRequired,
  description,
  variant = 'full',
}: UpgradeBannerProps) {
  const upgradeState = featureFlag ? { feature: featureFlag } : undefined;

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-200/60 text-amber-600">
          <Lock className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 truncate">
            {featureLabel ?? 'Funcionalidade bloqueada'}
          </p>
          {planRequired && (
            <p className="text-xs text-amber-600">Disponível no plano {planRequired}</p>
          )}
        </div>
        <Link
          to="/admin/upgrade"
          state={upgradeState}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm"
        >
          Upgrade
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  // variant === 'full' — ocupa o espaço da página/seção bloqueada
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      {/* Ícone */}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Lock className="h-8 w-8" />
      </div>

      {/* Texto principal */}
      <h3 className="text-xl font-bold text-slate-800">
        {featureLabel ?? 'Funcionalidade bloqueada'}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {planRequired && (
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700">
          <Sparkles className="h-3 w-3" />
          Disponível no plano {planRequired}
        </span>
      )}

      {/* CTA */}
      <Link
        to="/admin/upgrade"
        state={upgradeState}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F87116] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#ea580c] hover:shadow-md"
      >
        Ver planos e fazer upgrade
        <ArrowRight className="h-4 w-4" />
      </Link>

      <p className="mt-4 text-xs text-slate-400">
        Fale com o nosso suporte pelo WhatsApp para ativar seu novo plano.
      </p>
    </div>
  );
}
