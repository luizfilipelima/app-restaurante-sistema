/**
 * Temas do cardápio: padrão (fixo) e minimalistas claro/escuro com cor de detalhe editável.
 * Paletas em HSL para Tailwind; temas minimalistas usam neutros + primary/accent da cor escolhida.
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
  /** Matiz HSL (0-360) para primary/accent */
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

const baseDarkMuted = '217.2 32.6% 17.5%';
const baseDarkMutedFg = '215 20.2% 65.1%';
const baseDarkBorder = '217.2 32.6% 17.5%';

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

/** Cores de detalhe para temas minimalistas */
export const MENU_THEME_ACCENT_OPTIONS: MenuThemeAccentOption[] = [
  { id: 'orange', name: 'Laranja', hue: 24, hex: '#f97316' },
  { id: 'blue', name: 'Azul', hue: 217, hex: '#3b82f6' },
  { id: 'emerald', name: 'Verde', hue: 160, hex: '#10b981' },
  { id: 'violet', name: 'Violeta', hue: 263, hex: '#8b5cf6' },
  { id: 'rose', name: 'Rosa', hue: 350, hex: '#f43f5e' },
  { id: 'amber', name: 'Âmbar', hue: 38, hex: '#f59e0b' },
];

const DEFAULT_ACCENT_ID = 'orange';

function getAccentHue(accentId: string | null | undefined): number {
  const opt = MENU_THEME_ACCENT_OPTIONS.find((a) => a.id === accentId);
  return opt?.hue ?? 24; // orange
}

/** Gera paleta minimalista: fundos neutros + primary/accent em uma cor só */
export function getMinimalPalette(
  mode: 'light' | 'dark',
  accentId: string | null | undefined
): ThemePalette {
  const hue = getAccentHue(accentId);
  const primary = `${hue} 95% ${mode === 'light' ? '48%' : '55%'}`;
  const primaryFg = '0 0% 100%';
  const accent = mode === 'light' ? `${hue} 100% 96%` : `${hue} 30% 18%`;
  const accentFg = mode === 'light' ? `${hue} 95% 48%` : '0 0% 98%';

  if (mode === 'light') {
    return makePalette(
      'light',
      primary,
      primaryFg,
      primary,
      primaryFg,
      '0 0% 99%',
      '222.2 47% 11%',
      accent,
      accentFg,
      baseLightMuted,
      baseLightMutedFg,
      baseLightBorder
    );
  }

  return makePalette(
    'dark',
    primary,
    primaryFg,
    primary,
    primaryFg,
    '240 10% 6%',
    '0 0% 98%',
    accent,
    accentFg,
    baseDarkMuted,
    baseDarkMutedFg,
    baseDarkBorder
  );
}

export interface MenuThemeConfigResult {
  palette: ThemePalette;
  isDark: boolean;
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
  if (theme === 'default_light') {
    const t = MENU_THEMES.default_light;
    return t ? { palette: t.palette, isDark: false } : null;
  }
  if (theme === 'minimal_light') {
    return { palette: getMinimalPalette('light', menuThemeAccent), isDark: false };
  }
  if (theme === 'minimal_dark') {
    return { palette: getMinimalPalette('dark', menuThemeAccent), isDark: true };
  }
  // fallback
  const t = MENU_THEMES.default_light;
  return t ? { palette: t.palette, isDark: false } : null;
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

/** Cores de preview para um tema minimalista com determinada cor */
export function getMinimalPreviewColors(mode: 'light' | 'dark', accentId: string | null | undefined): string[] {
  const opt = MENU_THEME_ACCENT_OPTIONS.find((a) => a.id === (accentId || DEFAULT_ACCENT_ID)) ?? MENU_THEME_ACCENT_OPTIONS[0];
  if (mode === 'light') {
    return [opt.hex, '#ffffff', '#f1f5f9', '#0f172a', '#e2e8f0'];
  }
  return [opt.hex, '#18181b', '#27272a', '#3f3f46', '#52525b'];
}
