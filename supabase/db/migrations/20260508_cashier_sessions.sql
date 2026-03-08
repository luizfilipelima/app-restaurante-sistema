-- =============================================================================
-- Migration: Sessões de Caixa Diário (cashier_sessions)
-- Data: 2026-05-08
--
-- Permite ao dono do restaurante abrir e fechar o caixa diariamente, registrando
-- valor inicial e final para controle de fluxo de caixa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cashier_sessions (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id      UUID        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  date               DATE        NOT NULL,
  opening_amount     INTEGER     NOT NULL DEFAULT 0,
  closing_amount     INTEGER,
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at          TIMESTAMPTZ,
  opened_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, date)
);

COMMENT ON TABLE public.cashier_sessions IS 'Sessões de caixa diário: abertura e fechamento com valor inicial/final';
COMMENT ON COLUMN public.cashier_sessions.opening_amount IS 'Valor inicial ao abrir o caixa (centavos BRL ou inteiro PYG)';
COMMENT ON COLUMN public.cashier_sessions.closing_amount IS 'Valor final ao fechar o caixa (preenchido no fechamento)';
COMMENT ON COLUMN public.cashier_sessions.date IS 'Data do caixa (um registro por dia por restaurante)';

CREATE INDEX IF NOT EXISTS idx_cashier_sessions_restaurant_date
  ON public.cashier_sessions (restaurant_id, date);

-- Trigger updated_at
CREATE TRIGGER trg_cashier_sessions_updated_at
  BEFORE UPDATE ON public.cashier_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: owner, manager, cashier do restaurante ou super_admin
DROP POLICY IF EXISTS "Staff pode ver sessões do próprio restaurante" ON public.cashier_sessions;
CREATE POLICY "Staff pode ver sessões do próprio restaurante"
  ON public.cashier_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR (u.role = 'restaurant_admin' AND u.restaurant_id = cashier_sessions.restaurant_id)
        OR EXISTS (
          SELECT 1 FROM public.restaurant_user_roles rur
          WHERE rur.user_id = auth.uid()
            AND rur.restaurant_id = cashier_sessions.restaurant_id
            AND rur.is_active = true
            AND rur.role IN ('owner', 'manager', 'cashier')
        )
      )
    )
  );

-- INSERT/UPDATE: owner, manager, cashier ou restaurant_admin
DROP POLICY IF EXISTS "Staff pode inserir/atualizar sessões" ON public.cashier_sessions;
CREATE POLICY "Staff pode inserir/atualizar sessões"
  ON public.cashier_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR (u.role = 'restaurant_admin' AND u.restaurant_id = cashier_sessions.restaurant_id)
        OR EXISTS (
          SELECT 1 FROM public.restaurant_user_roles rur
          WHERE rur.user_id = auth.uid()
            AND rur.restaurant_id = cashier_sessions.restaurant_id
            AND rur.is_active = true
            AND rur.role IN ('owner', 'manager', 'cashier')
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'super_admin'
        OR (u.role = 'restaurant_admin' AND u.restaurant_id = cashier_sessions.restaurant_id)
        OR EXISTS (
          SELECT 1 FROM public.restaurant_user_roles rur
          WHERE rur.user_id = auth.uid()
            AND rur.restaurant_id = cashier_sessions.restaurant_id
            AND rur.is_active = true
            AND rur.role IN ('owner', 'manager', 'cashier')
        )
      )
    )
  );
