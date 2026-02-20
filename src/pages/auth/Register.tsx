import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { generateSlug } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  Loader2,
  AlertCircle,
  Check,
  BarChart3,
  Smartphone,
  ChefHat,
  Sparkles,
  Eye,
  EyeOff,
  ArrowRight,
  UtensilsCrossed,
  MessageSquare,
} from 'lucide-react';

// ─── Itens de benefício para o painel da marca ─────────────────────────────

const BENEFITS = [
  { icon: UtensilsCrossed, text: 'Cardápio digital com QR Code incluso' },
  { icon: ChefHat,         text: 'KDS — cozinha e salão em tempo real'  },
  { icon: BarChart3,       text: 'Dashboard BI com relatórios de vendas' },
  { icon: MessageSquare,   text: 'Integração com WhatsApp para pedidos'  },
  { icon: Smartphone,      text: 'Funciona no celular, tablet e computador' },
];

// ─── Força da senha ────────────────────────────────────────────────────────

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (pwd.length === 0) return { score: 0, label: '', color: '' };
  if (pwd.length < 6)   return { score: 1, label: 'Muito curta', color: 'bg-red-400' };
  const hasUpper  = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const variety   = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  if (pwd.length >= 8 && variety >= 2) return { score: 3, label: 'Forte', color: 'bg-emerald-500' };
  if (pwd.length >= 6 && variety >= 1) return { score: 2, label: 'Média', color:  'bg-amber-400'  };
  return { score: 1, label: 'Fraca', color: 'bg-red-400' };
}

// ─── Validação de slug ─────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function isSlugValid(slug: string): boolean {
  return slug.length >= 3 && SLUG_REGEX.test(slug);
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate();

  // Campos do formulário
  const [fullName,        setFullName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [restaurantName,  setRestaurantName]  = useState('');
  const [slug,            setSlug]            = useState('');
  const [slugEdited,      setSlugEdited]      = useState(false); // o usuário editou manualmente?
  const [phone,           setPhone]           = useState('');

  // Estado de UI
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  const pwStrength = getPasswordStrength(password);

  // ── Slug dinâmico: gera automaticamente ao digitar o nome do restaurante ──
  const handleRestaurantNameChange = useCallback((val: string) => {
    setRestaurantName(val);
    if (!slugEdited) {
      setSlug(generateSlug(val));
    }
  }, [slugEdited]);

  const handleSlugChange = useCallback((val: string) => {
    // Remove caracteres inválidos em tempo real enquanto o usuário digita
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(clean);
    setSlugEdited(true); // a partir de agora não substitui mais automaticamente
  }, []);

  // ── Submissão ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações client-side básicas
    if (!isSlugValid(slug)) {
      setError('O link personalizado é inválido. Use ao menos 3 letras, sem espaços ou caracteres especiais.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // ── Passo 1: Criar conta no Supabase Auth ───────────────────────────
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            // user_metadata: disponível imediatamente, sem trigger
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        // Traduz erros comuns do Supabase Auth para pt-BR
        if (signUpError.message.includes('already registered')) {
          throw new Error('Este e-mail já está cadastrado. Tente fazer login.');
        }
        throw signUpError;
      }

      // ── Passo 2: Provisionar restaurante via RPC setup_new_tenant ───────
      //
      // authData.session é não-nulo quando a confirmação de e-mail está desabilitada
      // (auto-confirm ativo no Supabase Dashboard).
      // Se for nulo, o usuário precisa confirmar o e-mail antes.
      if (!authData.session) {
        // Caso: confirmação de e-mail habilitada
        toast({
          title: 'Confirme seu e-mail',
          description: 'Enviamos um link de confirmação. Clique nele e faça login para terminar de configurar seu restaurante.',
        });
        navigate('/login');
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase.rpc('setup_new_tenant', {
        p_restaurant_name: restaurantName.trim(),
        p_slug:            slug,
        p_phone:           phone.trim() || null,
      });

      if (tenantError) {
        // O RAISE EXCEPTION da função PL/pgSQL vem como mensagem legível
        throw new Error(tenantError.message);
      }

      // ── Passo 3: Toast comemorativo + redirecionamento ──────────────────
      toast({
        title: '🎉 Bem-vindo ao Quiero.food!',
        description: `O seu restaurante foi criado com sucesso. Você tem 7 dias grátis no plano Básico.`,
      });

      // Pequena pausa para o toast aparecer antes do redirect
      await new Promise((r) => setTimeout(r, 400));

      // Redireciona para o painel — AdminRedirect resolve o slug e navega para /{slug}/painel
      navigate('/admin');

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen">

      {/* ── Painel esquerdo — Formulário ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-white">
        <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-12 max-w-lg mx-auto w-full">

          {/* Logo */}
          <div className="mb-8">
            <Link to="/login">
              <img
                src="/quierofood-logo-f.svg"
                alt="Quiero.food"
                className="h-9 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Cabeçalho */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">
              Crie sua conta grátis
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Configure seu restaurante em menos de 2 minutos. Sem cartão de crédito.
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Nome Completo */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-slate-700 font-medium text-sm">
                Nome Completo
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="João Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="joao@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors pr-11"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Indicador de força da senha */}
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          pwStrength.score >= bar ? pwStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {pwStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Divisor visual */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium">Dados do restaurante</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Nome do Restaurante */}
            <div className="space-y-1.5">
              <Label htmlFor="restaurantName" className="text-slate-700 font-medium text-sm">
                Nome do Restaurante
              </Label>
              <Input
                id="restaurantName"
                type="text"
                placeholder="Pizzaria do João"
                value={restaurantName}
                onChange={(e) => handleRestaurantNameChange(e.target.value)}
                required
                disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>

            {/* Slug / Link personalizado */}
            <div className="space-y-1.5">
              <Label htmlFor="slug" className="text-slate-700 font-medium text-sm">
                Link do seu cardápio
              </Label>
              <div className="relative">
                {/* Prefixo fixo */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none select-none">
                  <span className="text-slate-400 text-sm font-mono">quiero.food/</span>
                </div>
                <Input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  disabled={loading}
                  className={`h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-colors pl-[118px] pr-10 font-mono text-sm ${
                    slug.length > 0 && !isSlugValid(slug)
                      ? 'border-red-300 focus-visible:ring-red-300'
                      : 'border-slate-200'
                  }`}
                  placeholder="pizzaria-do-joao"
                  autoComplete="off"
                  spellCheck={false}
                />
                {/* Ícone de validação */}
                {slug.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isSlugValid(slug)
                      ? <Check className="h-4 w-4 text-emerald-500" />
                      : <AlertCircle className="h-4 w-4 text-red-400" />}
                  </div>
                )}
              </div>

              {/* Mensagens de validação / prévia */}
              {slug.length > 0 && !isSlugValid(slug) ? (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Use ao menos 3 caracteres: letras minúsculas, números e hifens. Sem espaços.
                </p>
              ) : slug.length > 0 ? (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-[#F87116]" />
                  Seu cardápio ficará em:{' '}
                  <span className="font-semibold text-slate-700">
                    quiero.food/{slug}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Gerado automaticamente pelo nome do restaurante. Você pode personalizar.
                </p>
              )}
            </div>

            {/* Telefone / WhatsApp */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-slate-700 font-medium text-sm">
                Telefone / WhatsApp{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                autoComplete="tel"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>

            {/* Mensagem de erro */}
            {error && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Botão de submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-base font-semibold bg-[#F87116] hover:bg-[#e56910] text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/30 transition-all gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Criando seu restaurante...
                </>
              ) : (
                <>
                  Criar conta grátis
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>

            {/* Aviso legal */}
            <p className="text-center text-xs text-slate-400 leading-relaxed">
              Ao criar sua conta, você concorda com os{' '}
              <span className="text-slate-500 underline-offset-2 hover:underline cursor-pointer">
                Termos de Uso
              </span>{' '}
              e a{' '}
              <span className="text-slate-500 underline-offset-2 hover:underline cursor-pointer">
                Política de Privacidade
              </span>.
            </p>
          </form>

          {/* Rodapé — link para login */}
          <p className="text-center text-sm text-slate-500 mt-8">
            Já tem uma conta?{' '}
            <Link
              to="/login"
              className="text-[#F87116] font-semibold hover:underline underline-offset-2"
            >
              Faça login
            </Link>
          </p>
        </div>
      </div>

      {/* ── Painel direito — Marca + Benefícios (hidden em mobile) ──────── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-shrink-0 flex-col bg-gradient-to-br from-[#F87116] to-[#c85c0a] relative overflow-hidden">

        {/* Círculos decorativos de fundo */}
        <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-black/10 translate-y-1/3 -translate-x-1/3 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 h-96 w-96 rounded-full bg-white/[0.03] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col h-full px-10 py-12">

          {/* Logo branca */}
          <div className="flex-shrink-0">
            <div className="inline-flex items-center justify-center bg-white/15 rounded-2xl px-5 py-3 backdrop-blur-sm border border-white/20">
              <img
                src="/quierofood-logo-f.svg"
                alt="Quiero.food"
                className="h-7 w-auto object-contain brightness-0 invert"
              />
            </div>
          </div>

          {/* Headline */}
          <div className="mt-12">
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight">
              Gerencie seu restaurante de onde estiver
            </h2>
            <p className="mt-4 text-white/75 text-base leading-relaxed">
              Cardápio digital, gestão de pedidos, cozinha inteligente e relatórios de vendas — tudo em uma plataforma.
            </p>
          </div>

          {/* Lista de benefícios */}
          <div className="mt-10 space-y-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.text} className="flex items-center gap-3">
                <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 border border-white/20">
                  <benefit.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Badge trial */}
          <div className="mt-auto pt-12">
            <div className="flex items-center gap-3 bg-black/20 backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">7 dias grátis no plano Básico</p>
                <p className="text-white/65 text-xs mt-0.5">
                  Sem cartão de crédito · Cancele quando quiser
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
