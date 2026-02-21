/**
 * Checkly — Monitoramento sintético
 * @see https://checklyhq.com/docs/detect/synthetic-monitoring/playwright-checks/configuration
 *
 * Executa smoke tests a cada 10 min contra produção (app.quiero.food).
 * Configure PLAYWRIGHT_BASE_URL=https://app.quiero.food e E2E_RESTAURANT_SLUG
 * no Checkly (Environment Variables) para um restaurante de teste isolado.
 */
import { defineConfig } from 'checkly';
import { Frequency } from 'checkly/constructs';

export default defineConfig({
  projectName: 'Quiero.food',
  logicalId: 'quiero-food',
  repoUrl: 'https://github.com/luizfilipelima/app-restaurante-sistema',
  checks: {
    playwrightConfigPath: './playwright.config.ts',
    playwrightChecks: [
      {
        name: 'Quiero.food Smoke',
        logicalId: 'smoke-suite',
        pwTags: ['@checkly'],
        frequency: Frequency.EVERY_10M,
        locations: ['us-east-1', 'eu-west-1'],
        activated: true,
        muted: false,
        // Checkly injeta env vars: defina PLAYWRIGHT_BASE_URL e E2E_RESTAURANT_SLUG no dashboard
        // para apontar ao ambiente de produção e restaurante de teste
      },
    ],
  },
});
