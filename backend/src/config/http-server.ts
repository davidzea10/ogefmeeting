import type { Server } from 'node:http';

/**
 * Timeouts HTTP adaptés à Render Starter (service always-on, réunions 2 h, WebSockets).
 * Évite les fermetures prématurées derrière le load balancer Render.
 */
export function configureHttpServerForProduction(server: Server): void {
  if (process.env.NODE_ENV !== 'production') return;

  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 125_000;
  server.requestTimeout = 0;
  server.timeout = 0;
}
