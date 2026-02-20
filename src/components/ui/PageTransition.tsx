import { motion } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * Variantes com transições por estado:
 *
 * - animate (entrada): 0.12s — fade-in + slide-up rápido
 * - exit     (saída):  0.06s — fade-out instantâneo
 *
 * Com AnimatePresence mode="wait", a saída bloqueia a entrada.
 * Durações curtas reduzem a sensação de lentidão na troca de telas.
 */
const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.12,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.06,
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
