/**
 * Temas pré-definidos do cardápio.
 * Cada tema possui paleta completa (HSL para Tailwind) e previewColors para a UI de seleção.
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
  category: 'restaurant' | 'festive';
  palette: ThemePalette;
  /** Cores hex para preview visual nos cards (4-5 cores) */
  previewColors: string[];
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

/** Dicionário completo de temas pré-definidos */
export const MENU_THEMES: Record<string, MenuTheme> = {
  // ─── Restaurante: Terroso (tons quentes, natural) ──────────────────────────
  earthy_light: {
    id: 'earthy_light',
    name: 'Terroso',
    mode: 'light',
    category: 'restaurant',
    previewColors: ['#c2410c', '#4d7c0f', '#78350f', '#fef3c7', '#e7e5e4'],
    palette: makePalette(
      'light',
      '24 89% 42%',     // terracotta
      '0 0% 100%',
      '84 64% 26%',     // olive
      '0 0% 100%',
      '40 20% 97%',     // warm cream
      '24 10% 15%',
      '24 80% 95%',     // light terracotta tint
      '24 89% 42%',
      baseLightMuted,
      baseLightMutedFg,
      baseLightBorder
    ),
  },
  earthy_dark: {
    id: 'earthy_dark',
    name: 'Terroso',
    mode: 'dark',
    category: 'restaurant',
    previewColors: ['#c2410c', '#4d7c0f', '#422006', '#1c1917', '#292524'],
    palette: makePalette(
      'dark',
      '24 89% 55%',
      '0 0% 100%',
      '84 64% 35%',
      '0 0% 100%',
      '24 10% 8%',
      '40 20% 95%',
      baseDarkMuted,
      '40 20% 95%',
      baseDarkMuted,
      baseDarkMutedFg,
      baseDarkBorder
    ),
  },

  // ─── Restaurante: Vibrante (fast-food, chamativo) ──────────────────────────
  vibrant_light: {
    id: 'vibrant_light',
    name: 'Vibrante',
    mode: 'light',
    category: 'restaurant',
    previewColors: ['#ea580c', '#dc2626', '#fbbf24', '#fef3c7', '#fef2f2'],
    palette: makePalette(
      'light',
      '24 95% 48%',     // orange
      '0 0% 100%',
      '0 72% 51%',      // red
      '0 0% 100%',
      '0 0% 99%',
      '0 0% 9%',
      '24 100% 96%',
      '24 95% 48%',
      baseLightMuted,
      baseLightMutedFg,
      baseLightBorder
    ),
  },
  vibrant_dark: {
    id: 'vibrant_dark',
    name: 'Vibrante',
    mode: 'dark',
    category: 'restaurant',
    previewColors: ['#ea580c', '#dc2626', '#1c1917', '#292524', '#450a0a'],
    palette: makePalette(
      'dark',
      '24 95% 53%',
      '0 0% 100%',
      '0 72% 55%',
      '0 0% 100%',
      '0 0% 7%',
      '0 0% 98%',
      baseDarkMuted,
      '0 0% 98%',
      baseDarkMuted,
      baseDarkMutedFg,
      baseDarkBorder
    ),
  },

  // ─── Restaurante: Minimalista Gourmet (elegante, clean) ────────────────────
  minimal_light: {
    id: 'minimal_light',
    name: 'Minimalista',
    mode: 'light',
    category: 'restaurant',
    previewColors: ['#334155', '#64748b', '#f1f5f9', '#0f172a', '#e2e8f0'],
    palette: makePalette(
      'light',
      '215 28% 27%',    // slate-700
      '0 0% 100%',
      '43 74% 43%',     // amber-600
      '0 0% 100%',
      '210 40% 98%',
      '222.2 84% 4.9%',
      '215 20% 96%',
      '215 28% 27%',
      baseLightMuted,
      baseLightMutedFg,
      baseLightBorder
    ),
  },
  minimal_dark: {
    id: 'minimal_dark',
    name: 'Minimalista',
    mode: 'dark',
    category: 'restaurant',
    previewColors: ['#64748b', '#94a3b8', '#0f172a', '#1e293b', '#334155'],
    palette: makePalette(
      'dark',
      '215 20% 65%',
      '222 47% 11%',
      '43 74% 50%',
      '222 47% 11%',
      '222.2 84% 4.9%',
      '210 40% 98%',
      baseDarkMuted,
      '210 40% 98%',
      baseDarkMuted,
      baseDarkMutedFg,
      baseDarkBorder
    ),
  },

  // ─── Festivo: Dia dos Namorados ────────────────────────────────────────────
  valentine_light: {
    id: 'valentine_light',
    name: 'Namorados',
    mode: 'light',
    category: 'festive',
    previewColors: ['#e11d48', '#ec4899', '#fce7f3', '#fdf2f8', '#fda4af'],
    palette: makePalette(
      'light',
      '346 77% 50%',    // rose-600
      '0 0% 100%',
      '330 81% 60%',    // pink-500
      '0 0% 100%',
      '330 100% 98%',
      '346 50% 15%',
      '330 80% 96%',
      '346 77% 50%',
      '330 50% 96%',
      '346 20% 45%',
      '330 30% 90%'
    ),
  },
  valentine_dark: {
    id: 'valentine_dark',
    name: 'Namorados',
    mode: 'dark',
    category: 'festive',
    previewColors: ['#e11d48', '#ec4899', '#4c0519', '#831843', '#1f0a14'],
    palette: makePalette(
      'dark',
      '346 77% 55%',
      '330 50% 10%',
      '330 81% 65%',
      '330 50% 10%',
      '330 40% 8%',
      '330 30% 95%',
      '330 40% 15%',
      '330 30% 95%',
      baseDarkMuted,
      baseDarkMutedFg,
      baseDarkBorder
    ),
  },

  // ─── Festivo: Natal ────────────────────────────────────────────────────────
  natal_light: {
    id: 'natal_light',
    name: 'Natal',
    mode: 'light',
    category: 'festive',
    previewColors: ['#15803d', '#dc2626', '#fef3c7', '#14532d', '#fef2f2'],
    palette: makePalette(
      'light',
      '142 71% 29%',    // green-700
      '0 0% 100%',
      '0 72% 51%',      // red
      '0 0% 100%',
      '142 30% 97%',
      '142 50% 12%',
      '142 50% 94%',
      '142 71% 29%',
      '142 25% 95%',
      '142 20% 40%',
      '142 20% 90%'
    ),
  },
  natal_dark: {
    id: 'natal_dark',
    name: 'Natal',
    mode: 'dark',
    category: 'festive',
    previewColors: ['#15803d', '#dc2626', '#052e16', '#450a0a', '#14532d'],
    palette: makePalette(
      'dark',
      '142 71% 40%',
      '142 50% 6%',
      '0 72% 55%',
      '142 50% 6%',
      '142 50% 6%',
      '142 30% 95%',
      '142 40% 12%',
      '142 30% 95%',
      baseDarkMuted,
      baseDarkMutedFg,
      baseDarkBorder
    ),
  },

  // ─── Festivo: Halloween ────────────────────────────────────────────────────
  halloween_light: {
    id: 'halloween_light',
    name: 'Halloween',
    mode: 'light',
    category: 'festive',
    previewColors: ['#ea580c', '#7c3aed', '#fef3c7', '#1e1b4b', '#f5f3ff'],
    palette: makePalette(
      'light',
      '24 95% 48%',     // orange
      '0 0% 100%',
      '263 70% 58%',    // violet-600
      '0 0% 100%',
      '263 30% 98%',
      '263 50% 15%',
      '263 50% 96%',
      '263 70% 58%',
      '263 25% 95%',
      '263 20% 45%',
      '263 25% 90%'
    ),
  },
  halloween_dark: {
    id: 'halloween_dark',
    name: 'Halloween',
    mode: 'dark',
    category: 'festive',
    previewColors: ['#ea580c', '#7c3aed', '#1e1b4b', '#422006', '#312e81'],
    palette: makePalette(
      'dark',
      '24 95% 53%',
      '263 50% 8%',
      '263 70% 62%',
      '263 50% 8%',
      '263 45% 8%',
      '263 30% 95%',
      '263 40% 15%',
      '263 30% 95%',
      baseDarkMuted,
      baseDarkMutedFg,
      baseDarkBorder
    ),
  },
};

/** IDs de temas agrupados por categoria para a UI */
export const THEME_IDS_BY_CATEGORY = {
  restaurant: ['earthy_light', 'earthy_dark', 'vibrant_light', 'vibrant_dark', 'minimal_light', 'minimal_dark'] as const,
  festive: ['valentine_light', 'valentine_dark', 'natal_light', 'natal_dark', 'halloween_light', 'halloween_dark'] as const,
};

export type MenuThemeId = keyof typeof MENU_THEMES;

/** Converte paleta em objeto de variáveis CSS para style inline */
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
