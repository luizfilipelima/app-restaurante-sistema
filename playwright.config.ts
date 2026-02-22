import { defineConfig, devices } from '@playwright/test';

const isCheckly = process.env.CHECKLY === '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

/**
 * Configuração E2E — app.quiero.food (Admin) e {slug}.quiero.food (Cardápio Público)
 * @see ARCHITECTURE.md — Estrutura multi-tenant e fluxos críticos
 *
 * Checkly: não inicia webServer; usa PLAYWRIGHT_BASE_URL (ex: https://app.quiero.food)
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Order flow usa múltiplos contextos sequenciais
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Evita conflito de estado entre Admin e Cardápio
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
      },
      testMatch: /.*\.spec\.ts/,
    },
    {
      name: 'public-menu',
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
      },
      testMatch: /.*\.spec\.ts/,
    },
  ],
  webServer: isCheckly
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true, // evita erro "port already in use" em execuções locais
        timeout: 60 * 1000,
      },
});
