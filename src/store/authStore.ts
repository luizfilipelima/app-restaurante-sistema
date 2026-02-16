import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User, UserRole } from '@/types';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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
      supabase.auth.onAuthStateChange(async (event, session) => {
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

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          session: data.session,
          user: userData,
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
