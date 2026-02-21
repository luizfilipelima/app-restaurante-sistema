import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, AlertCircle, Loader2, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const [loginOrEmail, setLoginOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, loading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signIn(loginOrEmail, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Verifique suas credenciais.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 sm:p-6">
      {/* Fundo sutil */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-orange-100/60 blur-3xl"
        />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-slate-200/40 blur-3xl"
        />
      </div>

      <div className="w-full max-w-[400px] relative">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <a
            href="https://quiero.food"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 rounded-lg"
          >
            <img
              src="/quierofood-logo-f.svg"
              alt="Quiero.food"
              className="h-10 sm:h-11 w-auto object-contain"
            />
          </a>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-slate-800">
              Acessar o sistema
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Use seu e-mail ou usuário e senha para entrar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="loginOrEmail" className="text-slate-700 font-medium">
                E-mail ou usuário
              </Label>
              <Input
                id="loginOrEmail"
                data-testid="login-email"
                type="text"
                placeholder="seu@email.com"
                value={loginOrEmail}
                onChange={(e) => setLoginOrEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Senha
              </Label>
              <Input
                id="password"
                data-testid="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>
            {error && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}
            <Button
              type="submit"
              data-testid="login-submit"
              className="w-full h-12 rounded-xl text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/25 hover:shadow-orange-600/30 transition-all"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Link para criar conta */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-slate-500">
            Ainda não tem uma conta?
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 w-full justify-center h-11 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <UserPlus className="h-4 w-4 text-[#F87116]" />
            Criar nova conta grátis
          </Link>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Sistema de gestão para restaurantes · Quiero.food
        </p>
      </div>
    </div>
  );
}
