import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Plus, Check, Loader2, Calendar, Theater, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Mode = 'event' | 'show' | null;

type EventOption = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
};

type ShowOption = {
  id: string;
  title: string;
  venue: string | null;
  show_type: string | null;
  run_start: string | null;
  run_end: string | null;
};

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Failed to mark as attended';

export const AddAttendedDialog: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [query, setQuery] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const nowIso = useMemo(() => (mode === 'event' ? new Date().toISOString() : ''), [mode]);

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['attended-picker-events', nowIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, event_date, location')
        .lte('event_date', nowIso)
        .order('event_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: mode === 'event',
  });

  const { data: shows = [], isLoading: loadingShows } = useQuery({
    queryKey: ['attended-picker-shows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nyc_shows')
        .select('id, title, venue, show_type, run_start, run_end')
        .order('title', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: mode === 'show',
  });

  const close = () => {
    setMode(null);
    setQuery('');
  };

  const refreshAttendance = async () => {
    if (!user) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['attended-events', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['profile-section-content', user.id] }),
    ]);
  };

  const markEventDirectly = async (event: { id: string }) => {
    if (!user) return;

    const { data: existing, error: existingError } = await supabase
      .from('event_rsvps')
      .select('id')
      .eq('event_id', event.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const { error } = await supabase
        .from('event_rsvps')
        .update({ attended: true, attended_at: new Date().toISOString(), status: 'going' })
        .eq('id', existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('event_rsvps').insert({
      event_id: event.id,
      user_id: user.id,
      name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || 'Attendee',
      email: user.email || '',
      role_type: 'audience',
      status: 'going',
      attended: true,
      attended_at: new Date().toISOString(),
    });
    if (error) throw error;
  };

  const markShowDirectly = async (show: { id: string }) => {
    if (!user) return;

    const { error } = await supabase
      .from('saved_shows')
      .upsert(
        {
          user_id: user.id,
          show_id: show.id,
          attended: true,
          attended_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,show_id' },
      );

    if (error) throw error;
  };

  const handleMarkEvent = async (event: EventOption) => {
    if (!user) return;
    setSubmittingId(event.id);
    try {
      const { error } = await supabase.rpc('mark_event_attended', { _event_id: event.id });

      if (error) {
        await markEventDirectly(event);
      }

      toast.success(`Marked "${event.title}" as attended`);
      await refreshAttendance();
      close();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleMarkShow = async (show: ShowOption) => {
    if (!user) return;
    setSubmittingId(show.id);
    try {
      const { error } = await supabase.rpc('mark_show_attended', { _show_id: show.id });

      if (error) {
        await markShowDirectly(show);
      }

      toast.success(`Marked "${show.title}" as attended`);
      await refreshAttendance();
      close();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Mark Attended
            <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => { setQuery(''); setMode('event'); }}>
            <Calendar className="w-4 h-4 mr-2" />
            Event
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setQuery(''); setMode('show'); }}>
            <Theater className="w-4 h-4 mr-2" />
            Show
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode === 'event'} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent
          className="max-w-lg p-0 gap-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>Mark a past event as attended</DialogTitle>
            <DialogDescription className="text-xs">
              Search published events you've attended.
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={true} className="rounded-none border-t">
            <CommandInput
              placeholder="Search past events…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-80">
              {loadingEvents ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <>
                  <CommandEmpty>No past events match your search.</CommandEmpty>
                  {events.map((ev: EventOption) => (
                    <CommandItem
                      key={ev.id}
                      value={`${ev.title} ${ev.location || ''}`}
                      onSelect={() => handleMarkEvent(ev)}
                      disabled={submittingId === ev.id}
                      className="px-4 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(ev.event_date).toLocaleDateString()}
                          {ev.location ? ` • ${ev.location}` : ''}
                        </p>
                      </div>
                      {submittingId === ev.id ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      ) : (
                        <Check className="w-4 h-4 opacity-0 ml-2" />
                      )}
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'show'} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent
          className="max-w-lg p-0 gap-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>Mark a show as attended</DialogTitle>
            <DialogDescription className="text-xs">
              Search shows from the Industry Now directory.
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={true} className="rounded-none border-t">
            <CommandInput
              placeholder="Search shows…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="max-h-80">
              {loadingShows ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <>
                  <CommandEmpty>No shows match your search.</CommandEmpty>
                  {shows.map((sh: ShowOption) => (
                    <CommandItem
                      key={sh.id}
                      value={`${sh.title} ${sh.venue || ''} ${sh.show_type || ''}`}
                      onSelect={() => handleMarkShow(sh)}
                      disabled={submittingId === sh.id}
                      className="px-4 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sh.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sh.venue || sh.show_type || 'Show'}
                        </p>
                      </div>
                      {submittingId === sh.id ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      ) : (
                        <Check className="w-4 h-4 opacity-0 ml-2" />
                      )}
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};
