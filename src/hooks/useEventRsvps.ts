import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string | null;
  name: string;
  email?: string | null;
  is_anonymous?: boolean | null;
  role_type: string;
  status: string;
  custom_answer?: string | null;
  created_at: string;
  attended?: boolean | null;
  attended_at?: string | null;
}

interface UseEventRsvpsOptions {
  includePrivate?: boolean;
}

export function useEventRsvps(eventId: string, options: UseEventRsvpsOptions = {}) {
  const queryClient = useQueryClient();
  const { includePrivate = false } = options;

  const { data: rsvps = [], isLoading } = useQuery({
    queryKey: ['event-rsvps', eventId, includePrivate ? 'private' : 'public'],
    queryFn: async () => {
      const query = includePrivate
        ? supabase
            .from('event_rsvps')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: true })
        : supabase.rpc('get_public_event_rsvps', { target_event_id: eventId });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((rsvp) => ({
        ...rsvp,
        is_anonymous: (rsvp as EventRsvp).is_anonymous ?? false,
      })) as EventRsvp[];
    },
    enabled: !!eventId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`event-rsvps-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_rsvps',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);

  const goingCount = rsvps.filter((r) => r.status === 'going').length;
  const cantMakeItCount = rsvps.filter((r) => r.status === 'cant_make_it').length;
  const goingRsvps = rsvps.filter((r) => r.status === 'going');

  const submitRsvp = useMutation({
    mutationFn: async (payload: {
      event_id: string;
      name: string;
      email: string;
      role_type: string;
      status: string;
      custom_answer?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let isAnonymous = false;

      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('anonymous_event_rsvps')
          .eq('user_id', user.id)
          .maybeSingle();

        isAnonymous = Boolean((profile as { anonymous_event_rsvps?: boolean } | null)?.anonymous_event_rsvps);
      }

      const insertPayload = {
        ...payload,
        user_id: user?.id ?? null,
        is_anonymous: isAnonymous,
      };

      const eventRsvpsTable = supabase.from('event_rsvps') as ReturnType<typeof supabase.from> & {
        insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };

      const { error } = await eventRsvpsTable.insert(insertPayload);
      if (error && /is_anonymous|anonymous_event_rsvps|schema cache|column/i.test(error.message)) {
        const { is_anonymous: _isAnonymous, ...legacyPayload } = insertPayload;
        const { error: retryError } = await eventRsvpsTable.insert(legacyPayload);
        if (retryError) throw retryError;
        return;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
    },
  });

  return { rsvps, goingRsvps, goingCount, cantMakeItCount, isLoading, submitRsvp };
}
