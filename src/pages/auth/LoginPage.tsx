import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Pizza, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, loading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <Card className="w-full max-w-md relative shadow-premium-lg border-0">
        <CardHeader className="space-y-4 pb-8">
          <div className="flex items-center justify-center mb-2">
            <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center shadow-premium-lg">
              <Pizza className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl text-center font-bold">
              Sistema de Gestão
            </CardTitle>
            <CardDescription className="text-center text-base">
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11 text-base"
              />
            </div>
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-800 text-sm p-4 rounded-xl flex items-start gap-3 animate-slide-in-bottom">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold gradient-primary hover:shadow-premium-lg transition-all hover:scale-[1.02]" 
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

          {/* Demonstração de Credenciais */}
          <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-100">
            <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">
              💡 Credenciais de Demonstração
            </p>
            <div className="space-y-1 text-xs text-blue-700">
              <p><span className="font-semibold">Super Admin:</span> admin@sistema.com</p>
              <p><span className="font-semibold">Senha:</span> senha123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
