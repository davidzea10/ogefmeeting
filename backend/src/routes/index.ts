import { Router } from 'express';
import {
  directionsRouter,
  modelesRouter,
  profilsRouter,
  rechercheRouter,
} from './admin.routes.js';
import { actionsRouter } from './actions.routes.js';
import { authRouter } from './auth.routes.js';
import { comptesRendusRouter } from './comptes-rendus.routes.js';
import { decisionsRouter } from './decisions.routes.js';
import { healthRouter } from './health.routes.js';
import { reunionsRouter } from './reunions.routes.js';
import {
  auditRouter,
  profilRouter,
  utilisateursRouter,
} from './utilisateur.routes.js';
import { attachAuth } from '../middleware/auth.js';

/**
 * Agrégateur des routes API.
 * attachAuth : reconnaît le JWT s'il est présent, sans jamais bloquer (AUTH_ENFORCED=false).
 */
export const apiRouter = Router();

/** Health avant auth — diagnostic même si attachAuth pose problème */
apiRouter.use('/health', healthRouter);

apiRouter.use(attachAuth);

apiRouter.use('/auth', authRouter);
apiRouter.use('/profil', profilRouter);
apiRouter.use('/utilisateurs', utilisateursRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/reunions', reunionsRouter);
apiRouter.use('/comptes-rendus', comptesRendusRouter);
apiRouter.use('/actions', actionsRouter);
apiRouter.use('/decisions', decisionsRouter);
apiRouter.use('/directions', directionsRouter);
apiRouter.use('/profils', profilsRouter);
apiRouter.use('/modeles-compte-rendu', modelesRouter);
apiRouter.use('/recherche', rechercheRouter);
