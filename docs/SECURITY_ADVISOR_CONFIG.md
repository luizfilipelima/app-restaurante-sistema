# Configurações manuais do Supabase Security Advisor

Alguns avisos do Security Advisor exigem configuração manual no dashboard do Supabase.

## Leaked Password Protection (auth_leaked_password_protection)

O Supabase Auth pode bloquear senhas comprometidas verificando contra a base HaveIBeenPwned.org.

**Como habilitar:**
1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Authentication** > **Settings** > **Security**
4. Habilite **Leaked Password Protection**

**Documentação:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
