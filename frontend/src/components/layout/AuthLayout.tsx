import { SkipLink } from '@/components/a11y/SkipLink';
import { Logo } from '@/components/brand/Logo';
import { PageBackground } from '@/components/brand/PageBackground';
import { PageTransition } from '@/components/motion/PageTransition';
import { easeOutExpo, useMotionSafe } from '@/lib/motion';
import { motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  const motionSafe = useMotionSafe();

  return (
    <PageBackground overlay="gradient">
      <SkipLink />
      <div className="grid min-h-dvh lg:grid-cols-2">
        <motion.div
          className="relative hidden flex-col justify-between p-8 xl:p-12 text-white lg:flex"
          initial={motionSafe ? { opacity: 0, x: -24 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: easeOutExpo }}
          aria-hidden
        >
          <Logo size="lg" showText />
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ogefrem-yellow">
              Ogefmeeting
            </p>
            <p className="max-w-md text-4xl font-bold leading-tight">
              Gestion intelligente des réunions de direction
            </p>
            <p className="max-w-md text-lg text-white/90">
              Planifiez, conduisez et archivez les réunions de l&apos;OGEFREM avec une
              expérience intuitive, innovante et intégrée.
            </p>
          </div>
          <p className="text-sm text-white/75">Kinshasa · République Démocratique du Congo</p>
        </motion.div>

        <div
          className="flex items-center justify-center px-4 py-6 sm:p-6 md:p-10"
          style={{
            paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
          <div
            id="contenu-principal"
            tabIndex={-1}
            className="glass-panel w-full max-w-md rounded-2xl p-5 shadow-lg sm:p-8"
            role="main"
            aria-label="Formulaire d'authentification"
          >
            <div className="mb-6 flex justify-center lg:hidden">
              <Logo size="md" />
            </div>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
