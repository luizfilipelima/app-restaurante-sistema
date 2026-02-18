import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const SESSION_ID_KEY = 'app_session_id';
const HEARTBEAT_INTERVAL = 60000; // 1 minuto

/**
 * Gera ou recupera um ID único de sessão para esta aba do navegador
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Hook para gerenciar sessões ativas por restaurante (limite de 3 simultâneas)
 */
export function useSessionManager(userId: string | null, restaurantId: string | null) {
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Registrar sessão ao fazer login
  useEffect(() => {
    if (!userId || !restaurantId) {
      // Limpar sessão se não há usuário/restaurante
      if (sessionIdRef.current) {
        const sessionId = sessionIdRef.current;
        sessionIdRef.current = null;
        supabase.rpc('remove_session', {
          p_user_id: userId || '',
          p_session_id: sessionId,
        }).catch(console.error);
      }
      return;
    }

    const sessionId = getSessionId();
    sessionIdRef.current = sessionId;

    // Registrar sessão (remove a mais antiga se houver 3+)
    supabase
      .rpc('register_session', {
        p_user_id: userId,
        p_restaurant_id: restaurantId,
        p_session_id: sessionId,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Erro ao registrar sessão:', error);
        }
      });

    // Heartbeat periódico para manter sessão ativa
    heartbeatIntervalRef.current = setInterval(() => {
      supabase
        .rpc('update_session_heartbeat', {
          p_user_id: userId,
          p_session_id: sessionId,
        })
        .catch((err) => {
          console.error('Erro no heartbeat da sessão:', err);
        });
    }, HEARTBEAT_INTERVAL);

    // Limpar sessão ao fechar aba/navegador
    const handleBeforeUnload = () => {
      supabase
        .rpc('remove_session', {
          p_user_id: userId,
          p_session_id: sessionId,
        })
        .catch(console.error);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Remover sessão ao desmontar componente (logout, navegação)
      supabase
        .rpc('remove_session', {
          p_user_id: userId,
          p_session_id: sessionId,
        })
        .catch(console.error);
    };
  }, [userId, restaurantId]);
}
