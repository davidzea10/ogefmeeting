import { getSupabaseBrowser, isRealtimeConfigured } from '@/lib/supabase-browser';
import { TABLES } from '@ogefmeeting/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Intervalle de secours si Realtime Supabase indisponible (ms). */
const POLL_FALLBACK_MS = 5000;

/**
 * Abonne Realtime aux changements de la réunion (+ points ODJ + participants).
 * Fallback : polling lent si Supabase Realtime non configuré.
 */
export function useReunionRealtime(reunionId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!reunionId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['reunion', reunionId] });
    };

    const supabase = getSupabaseBrowser();

    if (supabase && isRealtimeConfigured()) {
      const channel = supabase
        .channel(`reunion-live-${reunionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.reunions,
            filter: `id=eq.${reunionId}`,
          },
          () => invalidate(),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.pointsOrdreJour,
            filter: `reunion_id=eq.${reunionId}`,
          },
          () => invalidate(),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.participantsReunion,
            filter: `reunion_id=eq.${reunionId}`,
          },
          () => invalidate(),
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }

    const poll = window.setInterval(invalidate, POLL_FALLBACK_MS);
    return () => window.clearInterval(poll);
  }, [reunionId, queryClient]);
}
