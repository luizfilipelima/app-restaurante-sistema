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
  { id: 'rose', name: 'Rosa', hue: 350, hex: '#fb7185' },
  { id: 'amber', name: 'Âmbar', hue: 38, hex: '#f59e0b' },
  { id: 'red', name: 'Vermelho', hue: 0, hex: '#ef4444' },
  { id: 'gold', name: 'Dourado', hue: 43, hex: '#d4af37' },
];

/** Gradiente dourado para primary quando accent é gold (simula ouro) */
export const GOLD_PRIMARY_GRADIENT = 'linear-gradient(135deg, hsl(48, 90%, 58%), hsl(38, 85%, 48%))';

const DEFAULT_ACCENT_ID = 'orange';

/** Cores customizadas: custom:H,S,L (HSL) ou custom#RRGGBB (hex) */
export function isCustomAccent(accentId: string | null | undefined): boolean {
  if (!accentId || typeof accentId !== 'string') return false;
  return accentId.startsWith('custom:') || accentId.startsWith('custom#');
}

export interface HslValues {
  h: number;
  s: number;
  l: number;
}

/** Converte hex (#RRGGBB ou RRGGBB) para HSL */
export function hexToHsl(hex: string): HslValues | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Extrai HSL de accent custom (custom:H,S,L ou custom#RRGGBB) */
export function parseCustomAccent(accentId: string | null | undefined): HslValues | null {
  if (!accentId || !isCustomAccent(accentId)) return null;
  if (accentId.startsWith('custom#')) {
    return hexToHsl(accentId.slice(7));
  }
  const m = /^custom:(\d+),(\d+),(\d+)$/.exec(accentId);
  if (!m) return null;
  const h = Math.min(360, Math.max(0, parseInt(m[1], 10)));
  const s = Math.min(100, Math.max(0, parseInt(m[2], 10)));
  const l = Math.min(100, Math.max(0, parseInt(m[3], 10)));
  return { h, s, l };
}

/** Converte HSL para string custom:HHH,SS,LL para salvar no banco */
export function hslToCustomAccent(h: number, s: number, l: number): string {
  return `custom:${Math.round(h)},${Math.round(s)},${Math.round(l)}`;
}

/** Converte HSL para hex (#RRGGBB) */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getAccentHue(accentId: string | null | undefined): number {
  const custom = parseCustomAccent(accentId);
  if (custom) return custom.h;
  const opt = MENU_THEME_ACCENT_OPTIONS.find((a) => a.id === accentId);
  return opt?.hue ?? 24;
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
  const custom = parseCustomAccent(accentId);
  const hue = custom ? custom.h : getAccentHue(accentId);
  // Primary: cor exata para custom; preset para gold; padrão para demais
  const primary =
    accentId === 'gold'
      ? '43 85% 52%'
      : custom
        ? `${custom.h} ${custom.s}% ${custom.l}%`
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
    menuThemeAccent &&
    (MENU_THEME_ACCENT_OPTIONS.some((a) => a.id === menuThemeAccent) || isCustomAccent(menuThemeAccent))
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

/** Cor padrão para meta theme-color e fallback no cleanup */
export const DEFAULT_THEME_COLOR = '#f8fafc';

/** Converte HSL da paleta (formato "H S% L%") para string CSS hsl(H, S%, L%) */
export function paletteHslToCss(s: string): string {
  if (!s || !s.includes('%')) return s;
  return `hsl(${s.replace(/ /g, ', ')})`;
}

/** Atualiza meta theme-color e background do html com a cor de fundo do tema */
export function updateDocumentThemeMeta(config: MenuThemeConfigResult | null): void {
  if (!config) return;
  const bgCss = paletteHslToCss(config.palette.background);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bgCss);
  document.documentElement.style.backgroundColor = bgCss;
}

/** Reseta meta theme-color e background do html (chamado no unmount) */
export function resetDocumentThemeMeta(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', DEFAULT_THEME_COLOR);
  document.documentElement.style.backgroundColor = '';
}

/** Retorna 5 cores da paleta para preview, em formato CSS (hsl) para uso em style */
export function getPalettePreviewColors(palette: ThemePalette): string[] {
  return [
    paletteHslToCss(palette.primary),
    paletteHslToCss(palette.background),
    paletteHslToCss(palette.card),
    paletteHslToCss(palette.foreground),
    paletteHslToCss(palette.border),
  ];
}

/** Cores de preview para um tema minimalista com determinada cor (usa paleta real) */
export function getMinimalPreviewColors(mode: 'light' | 'dark', accentId: string | null | undefined): string[] {
  const palette = getMinimalPalette(mode, accentId ?? DEFAULT_ACCENT_ID);
  return getPalettePreviewColors(palette);
}
