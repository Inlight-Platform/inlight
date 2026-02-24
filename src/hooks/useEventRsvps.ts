import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string | null;
  name: string;
  email: string;
  role_type: string;
  status: string;
  custom_answer: string | null;
  created_at: string;
}

export function useEventRsvps(eventId: string) {
  const queryClient = useQueryClient();

  const { data: rsvps = [], isLoading } = useQuery({
    queryKey: ['event-rsvps', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as EventRsvp[];
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
      const { error } = await supabase.from('event_rsvps').insert({
        ...payload,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
    },
  });

  return { rsvps, goingRsvps, goingCount, cantMakeItCount, isLoading, submitRsvp };
}
