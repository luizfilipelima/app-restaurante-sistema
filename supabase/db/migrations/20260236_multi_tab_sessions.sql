-- Migration: Suporte a múltiplas abas simultâneas com mesmo usuário
-- Data: 2026-02-19
-- Descrição: Permite até 20 sessões por (usuário, restaurante) em vez de 3 totais por restaurante

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
  v_max_sessions INTEGER := 20;
BEGIN
  -- Limpar sessões expiradas primeiro
  PERFORM cleanup_expired_sessions();

  -- Contar sessões ativas DESTE USUÁRIO neste restaurante (permite múltiplas abas do mesmo usuário)
  SELECT COUNT(*) INTO v_count
  FROM active_sessions
  WHERE user_id = p_user_id
    AND restaurant_id = p_restaurant_id
    AND last_seen > NOW() - INTERVAL '30 minutes';

  -- Se já há 20+ sessões deste usuário, remover apenas a mais antiga DESTE USUÁRIO
  IF v_count >= v_max_sessions THEN
    SELECT id INTO v_oldest_session_id
    FROM active_sessions
    WHERE user_id = p_user_id
      AND restaurant_id = p_restaurant_id
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

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Sessão registrada com sucesso'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.register_session(uuid, uuid, character varying) SET search_path = public;

COMMENT ON FUNCTION register_session IS 'Registra nova sessão ou atualiza existente. Permite até 20 abas simultâneas por usuário/restaurante. Remove apenas a mais antiga do próprio usuário quando exceder o limite.';
