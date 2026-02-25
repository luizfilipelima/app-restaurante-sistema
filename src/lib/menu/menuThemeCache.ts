/**
 * Cache de tema do cardápio por slug do restaurante.
 * Evita flash de tema padrão em visitas repetidas: aplica tema em cache imediatamente
 * no mount e atualiza quando a API retornar.
 */

const CACHE_KEY_PREFIX = 'menu_theme_';

export interface MenuThemeCacheEntry {
  menuThemeId: string | null;
  menuThemeAccent: string | null;
}

export function getMenuThemeCache(slug: string | null | undefined): MenuThemeCacheEntry | null {
  if (!slug?.trim()) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { menuThemeId?: string | null; menuThemeAccent?: string | null };
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      menuThemeId: parsed.menuThemeId ?? null,
      menuThemeAccent: parsed.menuThemeAccent ?? null,
    };
  } catch {
    return null;
  }
}

export function setMenuThemeCache(
  slug: string | null | undefined,
  entry: MenuThemeCacheEntry
): void {
  if (!slug?.trim()) return;
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${slug}`,
      JSON.stringify({
        menuThemeId: entry.menuThemeId,
        menuThemeAccent: entry.menuThemeAccent,
      })
    );
  } catch {
    /* ignore */
  }
}

/** Remove o cache de tema do restaurante (chamado ao salvar tema no admin). */
export function clearMenuThemeCache(slug: string | null | undefined): void {
  if (!slug?.trim()) return;
  try {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${slug}`);
  } catch {
    /* ignore */
  }
}
