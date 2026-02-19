import { motion } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * Variantes com transições por estado:
 *
 * - animate (entrada): 0.22s — fade-in + slide-up suave
 * - exit     (saída):  0.10s — fade-out acelerado
 *
 * Com AnimatePresence mode="wait", a saída bloqueia a entrada.
 * Manter o exit curto (≤ 0.12s) é crítico para que a nova tela
 * apareça rapidamente sem parecer que o sistema "travou".
 */
const pageVariants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      // Exit rápido: não queremos bloquear a nova tela por mais de 100ms.
      duration: 0.10,
      ease: [0.4, 0, 1, 1] as [number, number, number, number],
    },
  },
};

/**
 * Wrapper de transição de página.
 * Use como filho direto de <AnimatePresence mode="wait"> com `key={location.pathname}`.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
