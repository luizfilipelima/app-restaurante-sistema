import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User, UserRole } from '@/types';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (loginOrEmail: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      set({ loading: true });

      // Verifica sessão atual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Busca dados completos do usuário
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({
          session,
          user: userData,
          initialized: true,
          loading: false,
        });
      } else {
        set({ initialized: true, loading: false });
      }

      // Listener para mudanças de autenticação
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          set({ session, user: userData });
        } else {
          set({ session: null, user: null });
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ initialized: true, loading: false });
    }
  },

  signIn: async (loginOrEmail: string, password: string) => {
    try {
      set({ loading: true });

      let email = loginOrEmail.trim();
      if (!email.includes('@')) {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_for_login', {
          login_input: email,
        });
        if (rpcError || !resolvedEmail) {
          set({ loading: false });
          throw new Error('Usuário ou email não encontrado.');
        }
        email = resolvedEmail as string;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        let userData: unknown = null;
        const { data: profileFromDb, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profileError && profileFromDb) {
          userData = profileFromDb;
        }

        // Se não achou perfil, tenta Edge Function que cria automaticamente (evita rodar SQL à mão)
        if (!userData && data.session?.access_token) {
          const { data: fromFunction, error: fnError } = await supabase.functions.invoke(
            'get-or-create-my-profile',
            {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
            }
          );
          if (!fnError && fromFunction && !fromFunction.error) {
            userData = fromFunction;
          }
        }

        if (!userData) {
          const uid = data.user.id;
          await supabase.auth.signOut();
          set({ loading: false });
          throw new Error(
            `Login aceito, mas seu perfil não foi encontrado. Alternativas: 1) Publique a Edge Function "get-or-create-my-profile" no Supabase (ela cria o perfil no primeiro login). 2) Execute no SQL Editor o script supabase-fix-perfil-flxlima.sql. Seu UID: ${uid}`
          );
        }

        set({
          session: data.session,
          user: userData as User,
          loading: false,
        });
      }
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      await supabase.auth.signOut();
      set({ user: null, session: null, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  hasRole: (roles: UserRole[]) => {
    const { user } = get();
    return user ? roles.includes(user.role) : false;
  },
}));
