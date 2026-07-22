import { pageTransition, pageTransitionReduced, useMotionSafe } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
};

/** Transition fade/slide entre pages — respecte prefers-reduced-motion */
export function PageTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();
  const motionSafe = useMotionSafe();
  const variants = motionSafe ? pageTransition : pageTransitionReduced;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={variants.transition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
