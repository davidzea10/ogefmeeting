import 'dotenv/config';
import { createApp } from './app.js';
import { corsOrigins, env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      architecture: 'MVC',
      cors_origins: corsOrigins,
      supabase: Boolean(env.SUPABASE_URL),
      auth_anon: Boolean(env.SUPABASE_ANON_KEY),
    },
    'Ogefmeeting API démarrée',
  );
});
