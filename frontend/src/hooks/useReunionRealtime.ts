import { getSupabaseBrowser, isRealtimeConfigured } from '@/lib/supabase-browser';
import { TABLES } from '@ogefmeeting/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/** Polling HTTP de secours pendant le live (ms). */
const POLL_SECOURS_MS = 5000;
/** Polling plus fréquent si Realtime indisponible (ms). */
const POLL_SANS_REALTIME_MS = 3000;

/**
 * Abonne Realtime aux changements de la réunion (+ points ODJ + participants).
 * Polling HTTP en parallèle : Realtime peut rater un UPDATE (RLS, canal non SUBSCRIBED).
 */
export function useReunionRealtime(reunionId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!reunionId) return;

    const refetch = () => {
      void queryClient.refetchQueries({ queryKey: ['reunion', reunionId] });
    };

    const supabase = getSupabaseBrowser();
    const pollMs =
      supabase && isRealtimeConfigured() ? POLL_SECOURS_MS : POLL_SANS_REALTIME_MS;
    let channelCleanup: (() => void) | undefined;

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
          () => refetch(),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.pointsOrdreJour,
            filter: `reunion_id=eq.${reunionId}`,
          },
          () => refetch(),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.participantsReunion,
            filter: `reunion_id=eq.${reunionId}`,
          },
          () => refetch(),
        )
        .subscribe();

      channelCleanup = () => {
        void supabase.removeChannel(channel);
      };
    }

    refetch();
    const poll = window.setInterval(refetch, pollMs);

    return () => {
      window.clearInterval(poll);
      channelCleanup?.();
    };
  }, [reunionId, queryClient]);
}
