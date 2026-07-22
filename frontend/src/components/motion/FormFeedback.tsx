import { shakeVariants, useMotionSafe } from '@/lib/motion';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

type FormFeedbackProps = {
  message: string;
  type?: 'error' | 'success';
  shakeKey?: number;
};

/** Message d'erreur / succès avec shake optionnel */
export function FormFeedback({ message, type = 'error', shakeKey = 0 }: FormFeedbackProps) {
  const motionSafe = useMotionSafe();
  const isError = type === 'error';

  const content = (
    <div
      className={
        isError
          ? 'flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger'
          : 'flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success'
      }
      role={isError ? 'alert' : 'status'}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{message}</span>
    </div>
  );

  if (!motionSafe || !isError) {
    return content;
  }

  return (
    <motion.div
      key={shakeKey}
      variants={shakeVariants}
      initial="idle"
      animate="shake"
    >
      {content}
    </motion.div>
  );
}

type SuccessCheckProps = {
  label?: string;
  children?: ReactNode;
};

/** Feedback visuel de succès (checkmark animé) */
export function SuccessCheck({ label = 'Opération réussie', children }: SuccessCheckProps) {
  const motionSafe = useMotionSafe();

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <motion.div
        initial={motionSafe ? { scale: 0.4, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success"
      >
        <CheckCircle2 className="h-9 w-9" aria-hidden />
      </motion.div>
      <p className="text-lg font-semibold text-text">{label}</p>
      {children}
    </div>
  );
}
