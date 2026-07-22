import { getSupabaseBrowser, isRealtimeConfigured } from '@/lib/supabase-browser';
import { TABLES } from '@ogefmeeting/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Abonne Realtime aux changements de la réunion (+ points ODJ).
 * Fallback : polling 8s si Supabase non configuré.
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

    const poll = window.setInterval(invalidate, 8000);
    return () => window.clearInterval(poll);
  }, [reunionId, queryClient]);
}
