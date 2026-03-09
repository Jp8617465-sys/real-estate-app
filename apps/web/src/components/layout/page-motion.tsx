'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface PageMotionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a page or section with a fade-up entrance animation.
 * Fully skipped when the user prefers reduced motion.
 *
 * Usage:
 *   export default function DashboardPage() {
 *     return <PageMotion><YourContent /></PageMotion>;
 *   }
 */
export function PageMotion({ children, className }: PageMotionProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered container: children animate in one after another.
 * Pair with <MotionItem> for each child.
 */
export function StaggerContainer({ children, className }: PageMotionProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className }: PageMotionProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
      }}
    >
      {children}
    </motion.div>
  );
}
