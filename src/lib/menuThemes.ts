/**
 * Temas do cardápio: padrão (fixo) e minimalistas claro/escuro com cor de detalhe editável.
 * Paletas em HSL para Tailwind; temas minimalistas usam neutros TINTADOS pelo hue da cor
 * (fundo, card, muted, border refletem a cor escolhida) + primary/accent vivos.
 */

export interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface MenuTheme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  palette: ThemePalette;
  previewColors: string[];
}

/** Opção de cor para temas minimalistas (monocromática nos detalhes) */
export interface MenuThemeAccentOption {
  id: string;
  name: string;
  /** Matiz HSL (0-360) para primary/accent e para tintar neutros */
  hue: number;
  /** Cor hex para preview no seletor */
  hex: string;
}

/** Opção de tema na configuração */
export interface MenuThemeOption {
  id: 'default_light' | 'minimal_light' | 'minimal_dark';
  name: string;
  description: string;
  /** Se false, tema padrão não mostra seletor de cor */
  accentEditable: boolean;
  mode: 'light' | 'dark';
}

const baseLightMuted = '210 40% 96.1%';
const baseLightMutedFg = '215.4 16.3% 46.9%';
const baseLightBorder = '214.3 31.8% 91.4%';

function makePalette(
  mode: 'light' | 'dark',
  primary: string,
  primaryFg: string,
  secondary: string,
  secondaryFg: string,
  bg: string,
  fg: string,
  accent: string,
  accentFg: string,
  muted: string,
  mutedFg: string,
  border: string
): ThemePalette {
  const card = mode === 'light' ? '0 0% 100%' : bg;
  const popover = mode === 'light' ? '0 0% 100%' : bg;
  const cardFg = fg;
  const popoverFg = fg;
  const input = border;
  const ring = primary;

  return {
    background: bg,
    foreground: fg,
    card,
    cardForeground: cardFg,
    popover,
    popoverForeground: popoverFg,
    primary,
    primaryForeground: primaryFg,
    secondary,
    secondaryForeground: secondaryFg,
    muted,
    mutedForeground: mutedFg,
    accent,
    accentForeground: accentFg,
    border,
    input,
    ring,
  };
}

/** Tema padrão (único fixo, não editável) */
export const DEFAULT_THEME: MenuTheme = {
  id: 'default_light',
  name: 'Padrão',
  mode: 'light',
  previewColors: ['#f97316', '#ea580c', '#f1f5f9', '#0f172a', '#e2e8f0'],
  palette: makePalette(
    'light',
    '24 95% 48%',
    '0 0% 100%',
    '24 95% 44%',
    '0 0% 100%',
    '0 0% 99%',
    '222.2 84% 4.9%',
    '24 100% 96%',
    '24 95% 48%',
    baseLightMuted,
    baseLightMutedFg,
    baseLightBorder
  ),
};

/** Temas fixos (apenas padrão; minimalistas são gerados por getMinimalPalette) */
export const MENU_THEMES: Record<string, MenuTheme> = {
  default_light: DEFAULT_THEME,
};

/** Opções de tema na UI */
export const MENU_THEME_OPTIONS: MenuThemeOption[] = [
  { id: 'default_light', name: 'Padrão', description: 'Cores padrão do sistema (laranja)', accentEditable: false, mode: 'light' },
  { id: 'minimal_light', name: 'Claro minimalista', description: 'Tons brancos e neutros', accentEditable: true, mode: 'light' },
  { id: 'minimal_dark', name: 'Escuro minimalista', description: 'Fundo escuro, detalhes na cor escolhida', accentEditable: true, mode: 'dark' },
];

/** Cores de detalhe para temas minimalistas (incl. dourado) */
export const MENU_THEME_ACCENT_OPTIONS: MenuThemeAccentOption[] = [
  { id: 'orange', name: 'Laranja', hue: 24, hex: '#f97316' },
  { id: 'blue', name: 'Azul', hue: 217, hex: '#3b82f6' },
  { id: 'emerald', name: 'Verde', hue: 160, hex: '#10b981' },
  { id: 'violet', name: 'Violeta', hue: 263, hex: '#8b5cf6' },
  { id: 'rose', name: 'Rosa', hue: 350, hex: '#f43f5e' },
  { id: 'amber', name: 'Âmbar', hue: 38, hex: '#f59e0b' },
  { id: 'gold', name: 'Dourado', hue: 43, hex: '#d4af37' },
];

/** Gradiente dourado para primary quando accent é gold (simula ouro) */
export const GOLD_PRIMARY_GRADIENT = 'linear-gradient(135deg, hsl(48, 90%, 58%), hsl(38, 85%, 48%))';

const DEFAULT_ACCENT_ID = 'orange';

function getAccentHue(accentId: string | null | undefined): number {
  const opt = MENU_THEME_ACCENT_OPTIONS.find((a) => a.id === accentId);
  return opt?.hue ?? 24; // orange
}

/**
 * Gera paleta minimalista com NEUTROS TINTADOS pelo hue da cor:
 * fundo, card, muted e border usam o mesmo matiz com saturação baixa,
 * para o tema inteiro harmonizar com a cor de detalhe (primary/accent).
 */
export function getMinimalPalette(
  mode: 'light' | 'dark',
  accentId: string | null | undefined
): ThemePalette {
  const hue = getAccentHue(accentId);
  // Primary e accent vivos (detalhes e CTAs)
  const primary =
    accentId === 'gold'
      ? '43 85% 52%' // dourado sólido como fallback
      : `${hue} 95% ${mode === 'light' ? '48%' : '55%'}`;
  // Tema escuro: texto escuro nos botões primary para contraste (primary é claro)
  const primaryFg = mode === 'dark' ? '0 0% 9%' : '0 0% 100%';
  const accent = mode === 'light' ? `${hue} 100% 96%` : `${hue} 30% 18%`;
  const accentFg = mode === 'light' ? `${hue} 95% 48%` : '0 0% 98%';

  if (mode === 'light') {
    // Claro: fundos e bordas com leve tint do hue (creme/quente ou fresco conforme a cor)
    const bg = `${hue} 18% 98%`;
    const fg = `${hue} 28% 14%`; // texto escuro com tint (legível)
    const muted = `${hue} 20% 94%`;
    const mutedFg = `${hue} 22% 42%`;
    const border = `${hue} 18% 90%`;
    return makePalette(
      'light',
      primary,
      primaryFg,
      primary,
      primaryFg,
      bg,
      fg,
      accent,
      accentFg,
      muted,
      mutedFg,
      border
    );
  }

  // Escuro: fundos e bordas tintados pelo hue (sem azul neutro)
  const bg = `${hue} 12% 6%`;
  const fg = '0 0% 98%'; // branco para contraste
  const muted = `${hue} 14% 14%`;
  const mutedFg = `${hue} 15% 65%`;
  const border = `${hue} 14% 18%`;
  return makePalette(
    'dark',
    primary,
    primaryFg,
    primary,
    primaryFg,
    bg,
    fg,
    accent,
    accentFg,
    muted,
    mutedFg,
    border
  );
}

export interface MenuThemeConfigResult {
  palette: ThemePalette;
  isDark: boolean;
  /** ID do accent (para data-accent e gradiente dourado) */
  accentId: string | null;
  /** Quando accent é gold, gradiente para .bg-primary */
  primaryBgGradient?: string;
}

/**
 * Resolve tema + accent para a paleta efetiva.
 * null/desconhecido → tema padrão. minimal_light/minimal_dark usam menu_theme_accent.
 */
export function getMenuThemeConfig(
  menuTheme: string | null | undefined,
  menuThemeAccent: string | null | undefined
): MenuThemeConfigResult | null {
  const theme = menuTheme ?? 'default_light';
  const accentId =
    menuThemeAccent && MENU_THEME_ACCENT_OPTIONS.some((a) => a.id === menuThemeAccent)
      ? menuThemeAccent
      : null;

  if (theme === 'default_light') {
    const t = MENU_THEMES.default_light;
    return t
      ? { palette: t.palette, isDark: false, accentId: null }
      : null;
  }
  if (theme === 'minimal_light') {
    return {
      palette: getMinimalPalette('light', menuThemeAccent),
      isDark: false,
      accentId: accentId ?? DEFAULT_ACCENT_ID,
      primaryBgGradient: menuThemeAccent === 'gold' ? GOLD_PRIMARY_GRADIENT : undefined,
    };
  }
  if (theme === 'minimal_dark') {
    return {
      palette: getMinimalPalette('dark', menuThemeAccent),
      isDark: true,
      accentId: accentId ?? DEFAULT_ACCENT_ID,
      primaryBgGradient: menuThemeAccent === 'gold' ? GOLD_PRIMARY_GRADIENT : undefined,
    };
  }
  const t = MENU_THEMES.default_light;
  return t ? { palette: t.palette, isDark: false, accentId: null } : null;
}

/** IDs de tema válidos */
export type MenuThemeId = 'default_light' | 'minimal_light' | 'minimal_dark';

/** Normaliza valor do banco para tema válido */
export function normalizeMenuThemeId(theme: string | null | undefined): MenuThemeId {
  if (theme === 'minimal_light' || theme === 'minimal_dark') return theme;
  return 'default_light';
}

/** Converte paleta em variáveis CSS para style inline */
export function paletteToCssVars(palette: ThemePalette): Record<string, string> {
  return {
    '--background': palette.background,
    '--foreground': palette.foreground,
    '--card': palette.card,
    '--card-foreground': palette.cardForeground,
    '--popover': palette.popover,
    '--popover-foreground': palette.popoverForeground,
    '--primary': palette.primary,
    '--primary-foreground': palette.primaryForeground,
    '--secondary': palette.secondary,
    '--secondary-foreground': palette.secondaryForeground,
    '--muted': palette.muted,
    '--muted-foreground': palette.mutedForeground,
    '--accent': palette.accent,
    '--accent-foreground': palette.accentForeground,
    '--border': palette.border,
    '--input': palette.input,
    '--ring': palette.ring,
  };
}

/**
 * Variáveis CSS semânticas (success, warning, destructive, info) para temas customizados.
 * Quando o tema não é o padrão, essas cores seguem primary/accent para manter harmonia.
 */
export function getSemanticCssVarsForCustomTheme(palette: ThemePalette): Record<string, string> {
  return {
    '--success': palette.primary,
    '--success-foreground': palette.primaryForeground,
    '--warning': palette.accent,
    '--warning-foreground': palette.accentForeground,
    '--destructive': palette.primary,
    '--destructive-foreground': palette.primaryForeground,
    '--info': palette.accent,
    '--info-foreground': palette.accentForeground,
  };
}

/** Cores de preview para um tema minimalista com determinada cor */
export function getMinimalPreviewColors(mode: 'light' | 'dark', accentId: string | null | undefined): string[] {
  const opt = MENU_THEME_ACCENT_OPTIONS.find((a) => a.id === (accentId || DEFAULT_ACCENT_ID)) ?? MENU_THEME_ACCENT_OPTIONS[0];
  if (mode === 'light') {
    return [opt.hex, '#ffffff', '#f8fafc', '#0f172a', '#e2e8f0'];
  }
  return [opt.hex, '#18181b', '#27272a', '#3f3f46', '#52525b'];
}
