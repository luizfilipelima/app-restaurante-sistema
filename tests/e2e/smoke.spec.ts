/**
 * E2E Smoke: Monitoramento sintético — não altera banco de dados
 * Usado pelo Checkly para validar que a aplicação está online.
 *
 * Não requer credenciais. Apenas verifica carregamento das páginas principais.
 * Para produção: PLAYWRIGHT_BASE_URL=https://app.quiero.food
 * Para cardápio: em produção use subdomínio (slug.quiero.food); em dev use baseURL/slug
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke @checkly', () => {
  test('login page carrega', async ({ page, baseURL }) => {
    const res = await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('domcontentloaded');
    const root = await page.waitForSelector('#root', { state: 'attached', timeout: 5000 });
    expect(root).toBeTruthy();
    // Com .env (VITE_SUPABASE_URL) o app renderiza o login; sem .env apenas valida 200 + root
    const loginVisible =
      (await page.getByTestId('login-email').isVisible().catch(() => false)) ||
      (await page.getByPlaceholder(/seu@|email/i).isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /entrar/i }).isVisible().catch(() => false));
    const title = await page.title();
    expect(loginVisible || title.includes('Sistema') || title.includes('Gestão')).toBeTruthy();
  });

  test('landing ou cardápio responde', async ({ page, baseURL }) => {
    const slug = process.env.E2E_RESTAURANT_SLUG;
    if (!slug) {
      await page.goto(baseURL!);
      await page.waitForLoadState('domcontentloaded');
      expect(await page.title()).toBeTruthy();
      return;
    }
    await page.goto(`${baseURL}/${slug}`);
    await page.waitForLoadState('domcontentloaded');
    expect(await page.locator('body').count()).toBeGreaterThan(0);
  });
});
