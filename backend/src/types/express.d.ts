import type { AuthUser } from './auth.types.js';

declare global {
  namespace Express {
    interface Request {
      /** Présent uniquement si un JWT valide a été fourni */
      user?: AuthUser;
      /** Token Bearer brut (si fourni) */
      accessToken?: string;
    }
  }
}

export {};
