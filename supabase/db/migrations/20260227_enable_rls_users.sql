-- Corrige os lints do Supabase:
--   policy_exists_rls_disabled: tabela users tem políticas RLS mas RLS estava desabilitado
--   rls_disabled_in_public: tabela public.users exposta sem RLS

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
