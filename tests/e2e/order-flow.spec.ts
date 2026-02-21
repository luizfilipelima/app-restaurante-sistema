/**
 * E2E: Order Journey — Admin altera preço + zona → Cliente finaliza pedido
 * @see ARCHITECTURE.md §5.1 Ciclo Completo do Pedido
 *
 * Requer: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_RESTAURANT_SLUG
 * O restaurante deve ter feature_delivery_zones e pelo menos 1 produto ativo.
 */
import { test, expect } from '@playwright/test';

const SLUG = process.env.E2E_RESTAURANT_SLUG;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const isPlaceholder =
  !SLUG ||
  !ADMIN_EMAIL ||
  !ADMIN_PASSWORD ||
  ADMIN_EMAIL.includes('exemplo.com') ||
  ADMIN_PASSWORD === 'sua-senha';

const shouldSkip = isPlaceholder;

test.describe.configure({ mode: 'serial' });

test.describe('Order Journey (Admin → Cardápio → Checkout)', () => {
  test.skip(shouldSkip, 'Configure credenciais reais em .env.e2e (E2E_RESTAURANT_SLUG, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)');

  test('fluxo completo: alterar preço, ativar zona, adicionar ao carrinho, finalizar pedido', async ({
    page,
    context,
    baseURL,
  }) => {
    const slug = SLUG!;
    const base = baseURL || 'http://localhost:5173';

    // ─── 1. Login Admin ─────────────────────────────────────────────────────
    await page.goto(`${base}/login`);
    await page.getByTestId('login-email').fill(ADMIN_EMAIL!);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD!);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(RegExp(`/${slug}/painel`), { timeout: 15000 });

    // ─── 2. Admin: alterar preço de um produto ──────────────────────────────
    await page.goto(`${base}/${slug}/painel/menu`);
    await page.waitForLoadState('networkidle');

    const editBtn = page.getByRole('button', { name: 'Editar' }).first();
    await editBtn.click();

    const priceInput = page.getByTestId('product-price-input');
    await priceInput.clear();
    await priceInput.fill('29,90');
    await page.getByTestId('menu-save-product').click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 });

    // ─── 3. Admin: ativar zona de entrega ───────────────────────────────────
    await page.goto(`${base}/${slug}/painel/delivery-zones`);
    await page.waitForLoadState('networkidle');

    const activateBtn = page.getByRole('button', { name: 'Ativar' }).first();
    const createBtn = page.getByTestId('delivery-zone-new');

    if (await activateBtn.isVisible()) {
      await activateBtn.click();
    } else if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.getByLabel(/Nome do Bairro/i).fill('Centro E2E');
      await page.getByLabel(/Taxa de Entrega/i).fill('0');
      await page.getByRole('button', { name: 'Salvar' }).click();
    }

    await page.waitForTimeout(1500);

    // ─── 4. Abrir Cardápio Público em nova aba ──────────────────────────────
    const menuPage = await context.newPage();
    await menuPage.goto(`${base}/${slug}`);
    await menuPage.waitForLoadState('networkidle');

    // Aguarda cardápio carregar com produtos (preço varia por moeda: R$, Gs., etc.)
    await expect(menuPage.getByTestId(/product-add-/).first()).toBeVisible({ timeout: 8000 });

    // Primeiro produto simples (não pizza/marmita) — clicar no card ou no botão add
    const addBtn = menuPage.getByTestId(/product-add-/).first();
    await addBtn.click();

    await menuPage.getByTestId('menu-view-cart').click();
    await expect(menuPage.getByTestId('cart-checkout')).toBeVisible({ timeout: 3000 });
    await menuPage.getByTestId('cart-checkout').click();

    await expect(menuPage).toHaveURL(RegExp(`/${slug}/checkout`));

    // ─── 5. Checkout: preencher formulário ──────────────────────────────────
    await menuPage.getByRole('button', { name: /Delivery|Entrega/i }).click();

    await menuPage.getByTestId('checkout-name').fill('Cliente E2E Test');
    await menuPage.getByTestId('checkout-phone').fill('11999999999');

    const zoneSelect = menuPage.getByRole('combobox').or(menuPage.locator('[role="combobox"]'));
    if (await zoneSelect.isVisible()) {
      await zoneSelect.click();
      await menuPage.getByRole('option').first().click();
    }

    // Arrastar o mapa (MapAddressPicker) para disparar moveend
    const mapEl = menuPage.getByTestId('map-address-picker');
    await expect(mapEl).toBeVisible({ timeout: 5000 });
    const box = await mapEl.boundingBox();
    if (box) {
      await menuPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await menuPage.mouse.down();
      await menuPage.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
      await menuPage.mouse.up();
    }

    await menuPage.waitForTimeout(500);

    // Selecionar PIX ou primeira opção de pagamento
    const pixBtn = menuPage.getByRole('button', { name: 'PIX' });
    if (await pixBtn.isVisible()) {
      await pixBtn.click();
    }

    await menuPage.getByTestId('checkout-submit').click();

    // ─── 6. Validação: OrderConfirmation ou OrderTracking ───────────────────
    await expect(menuPage.getByTestId('order-confirmation-page')).toBeVisible({ timeout: 15000 });
  });
});
