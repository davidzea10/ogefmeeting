import { staggerContainer, staggerItem, useMotionSafe } from '@/lib/motion';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type StaggerListProps = {
  children: ReactNode;
  className?: string;
};

/** Apparition en cascade des enfants (listes, grilles) */
export function StaggerList({ children, className }: StaggerListProps) {
  const motionSafe = useMotionSafe();

  if (!motionSafe) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: StaggerListProps) {
  const motionSafe = useMotionSafe();

  if (!motionSafe) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
