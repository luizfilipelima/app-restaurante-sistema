/** Hooks por domínio — re-exporta auth, admin, menu, orders, printer, shared e queries */
export * from './auth';
export * from './admin';
export * from './menu';
export * from './orders';
export * from './printer';
export { useToast, toast, useDynamicFavicon, useSharingMeta, useOfflineSync } from './shared';
export * from './queries';
