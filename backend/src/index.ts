import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { configureHttpServerForProduction } from './config/http-server.js';
import { corsOrigins, env } from './config/env.js';
import { logger } from './lib/logger.js';
import { attachTranscriptionWebSocket } from './ws/transcription.ws.js';
import { attachTranscriptionViewWebSocket } from './ws/transcription-view.ws.js';

const app = createApp();
const server = createServer(app);
configureHttpServerForProduction(server);

attachTranscriptionWebSocket(server);
attachTranscriptionViewWebSocket(server);

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      architecture: 'MVC + WS',
      cors_origins: corsOrigins,
      supabase: Boolean(env.SUPABASE_URL),
      auth_anon: Boolean(env.SUPABASE_ANON_KEY),
      deepgram: Boolean(env.DEEPGRAM_API_KEY),
      ws_transcription: '/ws/transcription',
      ws_transcription_view: '/ws/transcription-view',
    },
    'Ogefmeeting API démarrée',
  );
});
