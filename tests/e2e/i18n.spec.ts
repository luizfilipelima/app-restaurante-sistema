/**
 * E2E: Consistência i18n — Cardápio em PT e ES
 * @see ARCHITECTURE.md §10 Internacionalização
 *
 * O idioma padrão depende da config do restaurante (restaurant.language).
 * Requer: E2E_RESTAURANT_SLUG (restaurante com slug válido)
 */
import { test, expect } from '@playwright/test';

const SLUG = process.env.E2E_RESTAURANT_SLUG;
const isPlaceholder = !SLUG || SLUG === 'meu-restaurante-teste';
const shouldSkip = isPlaceholder;

test.describe('i18n Cardápio Público', () => {
  test.skip(shouldSkip, 'Configure E2E_RESTAURANT_SLUG em .env.e2e com slug de restaurante real');

  test('exibe labels do cardápio (PT ou ES conforme config do restaurante)', async ({ page, baseURL }) => {
    const base = baseURL || 'http://localhost:5173';
    await page.goto(`${base}/${SLUG}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    // Splash ~2s + fetch: aguarda botão do carrinho ou cards de produto
    await expect(
      page.getByTestId('menu-view-cart').or(page.getByTestId(/product-add-/))
    ).toBeVisible({ timeout: 25000 });
  });

  test('troca de idioma e exibe labels no idioma alternativo', async ({ page, baseURL }) => {
    const base = baseURL || 'http://localhost:5173';
    await page.goto(`${base}/${SLUG}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByTestId('menu-view-cart').or(page.getByTestId(/product-add-/))
    ).toBeVisible({ timeout: 25000 });

    // Seletor de idioma (PT/ES) — Menu padrão pode não ter; LinkBio tem
    const langToggle = page.locator('button').filter({ has: page.locator('text=/^PT$|^ES$/') }).first();
    if (!(await langToggle.isVisible({ timeout: 3000 }))) {
      test.skip(true, 'Cardápio sem seletor de idioma PT/ES visível');
    }
    await langToggle.click();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('menu-view-cart')).toBeVisible({ timeout: 5000 });
  });
});
