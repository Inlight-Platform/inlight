import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Plus, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AddAttendedDialogProps {
  triggerClassName?: string;
}

export const AddAttendedDialog: React.FC<AddAttendedDialogProps> = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'event' | 'show'>('event');
  const [query, setQuery] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const nowIso = useMemo(() => new Date().toISOString(), [open]);

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
    enabled: open && tab === 'event',
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
    enabled: open && tab === 'show',
  });

  const handleMarkEvent = async (event: { id: string; title: string }) => {
    if (!user) return;
    setSubmittingId(event.id);
    try {
      const { data: existing } = await supabase
        .from('event_rsvps')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('event_rsvps')
          .update({ attended: true, attended_at: new Date().toISOString(), status: 'going' })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_rsvps').insert({
          event_id: event.id,
          user_id: user.id,
          name: user.user_metadata?.display_name || user.email || 'Attendee',
          email: user.email || '',
          role_type: 'audience',
          status: 'going',
          attended: true,
          attended_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      toast.success(`Marked "${event.title}" as attended`);
      queryClient.invalidateQueries({ queryKey: ['attended-events', user.id] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as attended');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleMarkShow = async (show: { id: string; title: string }) => {
    if (!user) return;
    setSubmittingId(show.id);
    try {
      const { data: existing } = await supabase
        .from('saved_shows')
        .select('id')
        .eq('show_id', show.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('saved_shows')
          .update({ attended: true, attended_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('saved_shows').insert({
          user_id: user.id,
          show_id: show.id,
          attended: true,
          attended_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      toast.success(`Marked "${show.title}" as attended`);
      queryClient.invalidateQueries({ queryKey: ['attended-events', user.id] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as attended');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
          <Plus className="w-4 h-4 mr-2" />
          Mark Attended
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark a past event or show as attended</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'event' | 'show'); setQuery(''); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="event">Event</TabsTrigger>
            <TabsTrigger value="show">Show</TabsTrigger>
          </TabsList>

          <TabsContent value="event" className="mt-3">
            <Command shouldFilter={true}>
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
                    {events.map((ev: any) => (
                      <CommandItem
                        key={ev.id}
                        value={`${ev.title} ${ev.location || ''}`}
                        onSelect={() => handleMarkEvent(ev)}
                        disabled={submittingId === ev.id}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ev.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(ev.event_date).toLocaleDateString()}
                            {ev.location ? ` • ${ev.location}` : ''}
                          </p>
                        </div>
                        {submittingId === ev.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 opacity-0" />
                        )}
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandList>
            </Command>
          </TabsContent>

          <TabsContent value="show" className="mt-3">
            <Command shouldFilter={true}>
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
                    {shows.map((sh: any) => (
                      <CommandItem
                        key={sh.id}
                        value={`${sh.title} ${sh.venue || ''} ${sh.show_type || ''}`}
                        onSelect={() => handleMarkShow(sh)}
                        disabled={submittingId === sh.id}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{sh.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {sh.venue || sh.show_type || 'Show'}
                          </p>
                        </div>
                        {submittingId === sh.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 opacity-0" />
                        )}
                      </CommandItem>
                    ))}
                  </>
                )}
              </CommandList>
            </Command>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
