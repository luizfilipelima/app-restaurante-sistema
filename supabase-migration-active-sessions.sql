-- Migration: Controle de sessões simultâneas por restaurante (máximo 3)
-- Data: 2026-02-17
-- Descrição: Limita a 3 logins simultâneos por restaurante para evitar lentidão

-- 1. Criar tabela active_sessions
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL, -- ID único da sessão do navegador (sessionStorage)
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_restaurant ON active_sessions(restaurant_id, last_seen);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen ON active_sessions(last_seen);

-- 2. Função para limpar sessões expiradas (sem heartbeat há mais de 30 minutos)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions
  WHERE last_seen < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- 3. Função para registrar ou atualizar sessão (com limite de 3 por restaurante)
CREATE OR REPLACE FUNCTION register_session(
  p_user_id UUID,
  p_restaurant_id UUID,
  p_session_id VARCHAR(255)
)
RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_oldest_session_id UUID;
  v_result JSONB;
BEGIN
  -- Limpar sessões expiradas primeiro
  PERFORM cleanup_expired_sessions();

  -- Contar sessões ativas para este restaurante
  SELECT COUNT(*) INTO v_count
  FROM active_sessions
  WHERE restaurant_id = p_restaurant_id
    AND last_seen > NOW() - INTERVAL '30 minutes';

  -- Se já há 3 ou mais sessões ativas, remover a mais antiga
  IF v_count >= 3 THEN
    SELECT id INTO v_oldest_session_id
    FROM active_sessions
    WHERE restaurant_id = p_restaurant_id
    ORDER BY last_seen ASC
    LIMIT 1;

    DELETE FROM active_sessions WHERE id = v_oldest_session_id;
  END IF;

  -- Registrar ou atualizar sessão atual
  INSERT INTO active_sessions (user_id, restaurant_id, session_id, last_seen, created_at)
  VALUES (p_user_id, p_restaurant_id, p_session_id, NOW(), NOW())
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET
    last_seen = NOW(),
    restaurant_id = p_restaurant_id;

  -- Retornar sucesso
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Sessão registrada com sucesso'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para remover sessão
CREATE OR REPLACE FUNCTION remove_session(
  p_user_id UUID,
  p_session_id VARCHAR(255)
)
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions
  WHERE user_id = p_user_id AND session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função para atualizar heartbeat (last_seen)
CREATE OR REPLACE FUNCTION update_session_heartbeat(
  p_user_id UUID,
  p_session_id VARCHAR(255)
)
RETURNS void AS $$
BEGIN
  UPDATE active_sessions
  SET last_seen = NOW()
  WHERE user_id = p_user_id AND session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Policies
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Usuários podem gerenciar suas próprias sessões
CREATE POLICY "Users can manage own sessions"
  ON active_sessions FOR ALL
  USING (auth.uid() = user_id);

-- Super admin pode ver todas as sessões
CREATE POLICY "Super admin can view all sessions"
  ON active_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- 7. Trigger para limpar sessões expiradas periodicamente (via cron ou manualmente)
-- Nota: Para execução automática, configure um cron job no Supabase ou chame cleanup_expired_sessions() periodicamente

COMMENT ON TABLE active_sessions IS 'Rastreia sessões ativas por restaurante (máximo 3 simultâneas)';
COMMENT ON FUNCTION register_session IS 'Registra nova sessão ou atualiza existente, removendo a mais antiga se houver 3+ sessões';
COMMENT ON FUNCTION remove_session IS 'Remove uma sessão específica';
COMMENT ON FUNCTION update_session_heartbeat IS 'Atualiza last_seen para indicar que a sessão está ativa';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Remove sessões sem heartbeat há mais de 30 minutos';
