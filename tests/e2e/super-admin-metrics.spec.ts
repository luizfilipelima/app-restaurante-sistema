/**
 * E2E: Super-Admin — GMV segregado por moeda
 * @see ARCHITECTURE.md §5.6 Super-Admin GMV por Moeda
 * @see priceHelper.ts — formatação por moeda (BRL, PYG, ARS)
 *
 * Requer: E2E_SUPER_ADMIN_EMAIL, E2E_SUPER_ADMIN_PASSWORD
 */
import { test, expect } from '@playwright/test';

const SUPER_EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL;
const SUPER_PASSWORD = process.env.E2E_SUPER_ADMIN_PASSWORD;

const isPlaceholder =
  !SUPER_EMAIL || !SUPER_PASSWORD || SUPER_PASSWORD === 'sua-senha';

const shouldSkip = isPlaceholder;

test.describe('Super-Admin GMV por moeda', () => {
  test.skip(shouldSkip, 'Configure credenciais reais em .env.e2e (E2E_SUPER_ADMIN_EMAIL, E2E_SUPER_ADMIN_PASSWORD)');

  test('exibe GMV segregado por moeda (BRL, PYG, ARS)', async ({ page, baseURL }) => {
    const base = baseURL || 'http://localhost:5173';

    await page.goto(`${base}/login`);
    await page.getByTestId('login-email').fill(SUPER_EMAIL!);
    await page.getByTestId('login-password').fill(SUPER_PASSWORD!);
    await page.getByTestId('login-submit').click();

    // Super-admin redireciona para /super-admin; admin comum vai para /slug/painel
    await expect(page).toHaveURL(/\/super-admin/, {
      timeout: 20000,
      timeoutMessage: 'Login não redirecionou para /super-admin — verifique se a conta tem role super_admin',
    });

    await page.goto(`${base}/super-admin/restaurants`);
    await page.waitForLoadState('networkidle');

    const gmvCard = page.getByTestId('gmv-by-currency');
    await expect(gmvCard).toBeVisible({ timeout: 10000 });

    const text = await gmvCard.textContent();
    expect(text).toBeDefined();

    // Deve conter label de moeda (BRL, PYG, ARS) ou "—" quando vazio
    const hasCurrencyLabels =
      text!.includes('BRL') ||
      text!.includes('R$') ||
      text!.includes('PYG') ||
      text!.includes('Gs.') ||
      text!.includes('ARS') ||
      text!.includes('—');
    expect(hasCurrencyLabels).toBeTruthy();
  });
});
