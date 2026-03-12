/**
 * Evolution API - URL base
 *
 * Usar VITE_EVOLUTION_API_URL no .env e no painel da Vercel.
 * Subdomínio api.quiero.food na VPS.
 */

export const EVOLUTION_API_BASE_URL =
  (import.meta.env.VITE_EVOLUTION_API_URL as string)?.trim() || 'https://api.quiero.food';
