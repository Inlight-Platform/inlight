import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, ChevronRight, Users, Camera, CheckCircle2, XCircle, Loader2, MapPin, Plus, Copy, Trash2, ExternalLink, QrCode, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Html5Qrcode } from 'html5-qrcode';

type EventPanelist = {
  id: string;
  event_id: string;
  user_id: string | null;
  display_name: string;
  title: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  headshot_url: string | null;
  cover_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  reel_url: string | null;
  skills: string[] | null;
  badges: string[] | null;
  public_slug: string;
  sort_order: number;
  is_active: boolean;
};

type AdminEvent = Database['public']['Tables']['events']['Row'];

type PublicProfileOption = {
  user_id: string;
  display_name: string | null;
  stage_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  role: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[] | null;
  badges: string[] | null;
  instagram_url: string | null;
  website_url: string | null;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `panelist-${Date.now()}`;

const splitList = (value: string) => {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const EventsManager: React.FC = () => {
  const { user } = useAuth();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [scannerEventId, setScannerEventId] = useState<string | null>(null);

  // Fetch all events created by the Inlight account
  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-inlight-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Inlight Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading events...</p>
        ) : events?.length === 0 ? (
          <p className="text-muted-foreground">No events created by Inlight yet.</p>
        ) : (
          <div className="space-y-2">
            {events?.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isExpanded={expandedEventId === event.id}
                onToggle={() =>
                  setExpandedEventId(expandedEventId === event.id ? null : event.id)
                }
                onScan={() => setScannerEventId(event.id)}
              />
            ))}
          </div>
        )}

        {scannerEventId && (
          <QrScannerDialog
            eventId={scannerEventId}
            onClose={() => setScannerEventId(null)}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Single event row with expandable RSVP list
const EventRow: React.FC<{
  event: AdminEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onScan: () => void;
}> = ({ event, isExpanded, onToggle, onScan }) => {
  const { data: rsvps, isLoading } = useQuery({
    queryKey: ['event-rsvps', event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isExpanded,
  });

  const goingCount = rsvps?.filter((r) => r.status === 'going').length ?? 0;
  const attendedCount = rsvps?.filter((r) => r.attended).length ?? 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{event.title}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(event.event_date), 'MMM d, yyyy · h:mm a')}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 ml-2">
            {event.is_paid && (
              <Badge variant="secondary" className="text-xs">Paid</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onScan();
              }}
              className="gap-1"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-3 space-y-3">
            <EventPanelistsSection event={event} />

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading RSVPs...</p>
            ) : rsvps?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <strong>{goingCount}</strong> going
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <strong>{attendedCount}</strong> checked in
                  </span>
                </div>
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {rsvps?.map((rsvp) => (
                    <div
                      key={rsvp.id}
                      className="flex items-center justify-between bg-background rounded-md p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{rsvp.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {rsvp.email} · {rsvp.role_type}
                        </div>
                      </div>
                      <div className="ml-2 shrink-0">
                        {rsvp.attended ? (
                          <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Checked in
                          </Badge>
                        ) : rsvp.status === 'going' ? (
                          <Badge variant="outline">Going</Badge>
                        ) : (
                          <Badge variant="secondary">{rsvp.status}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const emptyPanelistForm = {
  user_id: null as string | null,
  display_name: '',
  title: '',
  headline: '',
  location: '',
  bio: '',
  headshot_url: '',
  cover_url: '',
  website_url: '',
  instagram_url: '',
  reel_url: '',
  skills: '',
  badges: '',
  public_slug: '',
  sort_order: 0,
  is_active: true,
};

const EventPanelistsSection: React.FC<{ event: AdminEvent }> = ({ event }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanelist, setEditingPanelist] = useState<EventPanelist | null>(null);
  const [qrPanelist, setQrPanelist] = useState<EventPanelist | null>(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [form, setForm] = useState(emptyPanelistForm);

  const panelistPublicBase = useMemo(() => {
    const eventIdentifier = event.slug || event.id;
    return `${window.location.origin}/events/${eventIdentifier}/panelists`;
  }, [event.id, event.slug]);

  const { data: panelists = [], isLoading } = useQuery({
    queryKey: ['admin-event-panelists', event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_panelists')
        .select('*')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .order('display_name', { ascending: true });
      if (error) throw error;
      return (data || []) as EventPanelist[];
    },
  });

  const { data: profileOptions = [] } = useQuery({
    queryKey: ['admin-panelist-profile-search', profileSearch],
    queryFn: async () => {
      const trimmed = profileSearch.trim();
      if (trimmed.length < 2) return [] as PublicProfileOption[];

      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, stage_name, avatar_url, cover_url, location, role, headline, bio, skills, badges, instagram_url, website_url')
        .or(`display_name.ilike.%${trimmed}%,stage_name.ilike.%${trimmed}%,role.ilike.%${trimmed}%`)
        .limit(8);
      if (error) throw error;
      return (data || []) as PublicProfileOption[];
    },
    enabled: profileSearch.trim().length >= 2,
  });

  const resetForm = () => {
    setEditingPanelist(null);
    setProfileSearch('');
    setForm({
      ...emptyPanelistForm,
      sort_order: panelists.length,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (panelist: EventPanelist) => {
    setEditingPanelist(panelist);
    setProfileSearch('');
    setForm({
      user_id: panelist.user_id,
      display_name: panelist.display_name,
      title: panelist.title || '',
      headline: panelist.headline || '',
      location: panelist.location || '',
      bio: panelist.bio || '',
      headshot_url: panelist.headshot_url || '',
      cover_url: panelist.cover_url || '',
      website_url: panelist.website_url || '',
      instagram_url: panelist.instagram_url || '',
      reel_url: panelist.reel_url || '',
      skills: (panelist.skills || []).join(', '),
      badges: (panelist.badges || []).join(', '),
      public_slug: panelist.public_slug,
      sort_order: panelist.sort_order,
      is_active: panelist.is_active,
    });
    setDialogOpen(true);
  };

  const applyProfileOption = (profile: PublicProfileOption) => {
    const name = profile.stage_name || profile.display_name || '';
    setForm((current) => ({
      ...current,
      user_id: profile.user_id,
      display_name: current.display_name || name,
      title: current.title || profile.role || '',
      headline: current.headline || profile.headline || '',
      location: current.location || profile.location || '',
      bio: current.bio || profile.bio || '',
      headshot_url: current.headshot_url || profile.avatar_url || '',
      cover_url: current.cover_url || profile.cover_url || '',
      website_url: current.website_url || profile.website_url || '',
      instagram_url: current.instagram_url || profile.instagram_url || '',
      skills: current.skills || (profile.skills || []).join(', '),
      badges: current.badges || (profile.badges || []).join(', '),
      public_slug: current.public_slug || slugify(name),
    }));
    setProfileSearch('');
  };

  const savePanelist = useMutation({
    mutationFn: async () => {
      const displayName = form.display_name.trim();
      if (!displayName) throw new Error('Panelist name is required.');

      const payload = {
        event_id: event.id,
        user_id: form.user_id || null,
        display_name: displayName,
        title: form.title.trim() || null,
        headline: form.headline.trim() || null,
        location: form.location.trim() || null,
        bio: form.bio.trim() || null,
        headshot_url: form.headshot_url.trim() || null,
        cover_url: form.cover_url.trim() || null,
        website_url: form.website_url.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        reel_url: form.reel_url.trim() || null,
        skills: splitList(form.skills),
        badges: splitList(form.badges),
        public_slug: slugify(form.public_slug || displayName),
        sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : 0,
        is_active: form.is_active,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      };

      const query = editingPanelist
        ? supabase.from('event_panelists').update(payload).eq('id', editingPanelist.id)
        : supabase.from('event_panelists').insert(payload);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event-panelists', event.id] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingPanelist ? 'Panelist updated' : 'Panelist added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save panelist.');
    },
  });

  const deletePanelist = useMutation({
    mutationFn: async (panelistId: string) => {
      const { error } = await supabase
        .from('event_panelists')
        .delete()
        .eq('id', panelistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event-panelists', event.id] });
      toast.success('Panelist removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not remove panelist.');
    },
  });

  const togglePanelist = useMutation({
    mutationFn: async (panelist: EventPanelist) => {
      const { error } = await supabase
        .from('event_panelists')
        .update({ is_active: !panelist.is_active, updated_at: new Date().toISOString() })
        .eq('id', panelist.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-event-panelists', event.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not update panelist visibility.');
    },
  });

  const copyPanelistUrl = async (panelist: EventPanelist) => {
    await navigator.clipboard.writeText(`${panelistPublicBase}/${panelist.public_slug}`);
    toast.success('Panelist URL copied');
  };

  return (
    <section className="rounded-lg border bg-background p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium">Panelists</h3>
          <p className="text-xs text-muted-foreground">
            Admin-only setup for public Hot Seat panelist profiles.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Add Panelist
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading panelists...</p>
        ) : panelists.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No panelists added yet.
          </p>
        ) : (
          panelists.map((panelist) => (
            <div key={panelist.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {panelist.headshot_url ? (
                  <img src={panelist.headshot_url} alt="" className="h-12 w-12 rounded-md object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-sm font-semibold">
                    {panelist.display_name[0]?.toUpperCase() || 'P'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{panelist.display_name}</p>
                    <Badge variant={panelist.is_active ? 'default' : 'secondary'} className="text-xs">
                      {panelist.is_active ? 'Public' : 'Hidden'}
                    </Badge>
                    {panelist.user_id && <Badge variant="outline" className="text-xs">Inlight user</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[panelist.title, panelist.location].filter(Boolean).join(' · ') || 'No title'} · /{panelist.public_slug}
                  </p>
                  {panelist.headline && (
                    <p className="max-w-xl truncate text-xs text-muted-foreground">{panelist.headline}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Switch
                  checked={panelist.is_active}
                  onCheckedChange={() => togglePanelist.mutate(panelist)}
                  aria-label={`Toggle ${panelist.display_name} visibility`}
                />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyPanelistUrl(panelist)}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy URL
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setQrPanelist(panelist)}>
                  <QrCode className="h-3.5 w-3.5" />
                  QR
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEditDialog(panelist)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deletePanelist.mutate(panelist.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPanelist ? 'Edit Panelist' : 'Add Panelist'}</DialogTitle>
            <DialogDescription>
              Link an existing Inlight user when possible, or enter standalone public details for the event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`profile-search-${event.id}`}>Find existing Inlight user</Label>
              <Input
                id={`profile-search-${event.id}`}
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                placeholder="Search by name, stage name, or role"
              />
              {profileOptions.length > 0 && (
                <div className="rounded-md border">
                  {profileOptions.map((profile) => {
                    const name = profile.stage_name || profile.display_name || 'Unnamed user';
                    return (
                      <button
                        key={profile.user_id}
                        type="button"
                        className="flex w-full items-center gap-3 border-b p-2 text-left last:border-b-0 hover:bg-muted/60"
                        onClick={() => applyProfileOption(profile)}
                      >
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {name[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{name}</p>
                          <p className="truncate text-xs text-muted-foreground">{profile.role || 'No role listed'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Profile basics</p>
                <p className="text-xs text-muted-foreground">
                  These mirror the key details attendees expect on an Inlight profile.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`panelist-name-${event.id}`}>Display name *</Label>
                <Input
                  id={`panelist-name-${event.id}`}
                  value={form.display_name}
                  onChange={(e) => setForm((current) => ({
                    ...current,
                    display_name: e.target.value,
                    public_slug: current.public_slug || slugify(e.target.value),
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`panelist-title-${event.id}`}>Title / role</Label>
                <Input
                  id={`panelist-title-${event.id}`}
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  placeholder="Founder, Actor, Director..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`panelist-headline-${event.id}`}>Headline</Label>
                <Input
                  id={`panelist-headline-${event.id}`}
                  value={form.headline}
                  onChange={(e) => setForm((current) => ({ ...current, headline: e.target.value }))}
                  placeholder="violinist based in New York City, NY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`panelist-location-${event.id}`}>Location</Label>
                <Input
                  id={`panelist-location-${event.id}`}
                  value={form.location}
                  onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                  placeholder="New York City, NY"
                />
              </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`panelist-bio-${event.id}`}>Bio</Label>
                <Textarea
                  id={`panelist-bio-${event.id}`}
                  value={form.bio}
                  onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Images and links</p>
                <p className="text-xs text-muted-foreground">
                  Headshot is the main profile image; cover image is optional context above it.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`panelist-headshot-${event.id}`}>Headshot URL</Label>
                  <Input
                    id={`panelist-headshot-${event.id}`}
                    value={form.headshot_url}
                    onChange={(e) => setForm((current) => ({ ...current, headshot_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`panelist-cover-${event.id}`}>Cover image URL</Label>
                  <Input
                    id={`panelist-cover-${event.id}`}
                    value={form.cover_url}
                    onChange={(e) => setForm((current) => ({ ...current, cover_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`panelist-website-${event.id}`}>Website URL</Label>
                  <Input
                    id={`panelist-website-${event.id}`}
                    value={form.website_url}
                    onChange={(e) => setForm((current) => ({ ...current, website_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`panelist-instagram-${event.id}`}>Instagram URL</Label>
                  <Input
                    id={`panelist-instagram-${event.id}`}
                    value={form.instagram_url}
                    onChange={(e) => setForm((current) => ({ ...current, instagram_url: e.target.value }))}
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`panelist-reel-${event.id}`}>Reel URL</Label>
                  <Input
                    id={`panelist-reel-${event.id}`}
                    value={form.reel_url}
                    onChange={(e) => setForm((current) => ({ ...current, reel_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Profile metadata</p>
                <p className="text-xs text-muted-foreground">Use comma-separated values for tags shown on the public page.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`panelist-skills-${event.id}`}>Skills</Label>
                  <Input
                    id={`panelist-skills-${event.id}`}
                    value={form.skills}
                    onChange={(e) => setForm((current) => ({ ...current, skills: e.target.value }))}
                    placeholder="Acting, Directing, Producing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`panelist-badges-${event.id}`}>Badges / affiliations</Label>
                  <Input
                    id={`panelist-badges-${event.id}`}
                    value={form.badges}
                    onChange={(e) => setForm((current) => ({ ...current, badges: e.target.value }))}
                    placeholder="Alumni '26, Broadway"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`panelist-slug-${event.id}`}>Public slug</Label>
                  <Input
                    id={`panelist-slug-${event.id}`}
                    value={form.public_slug}
                    onChange={(e) => setForm((current) => ({ ...current, public_slug: slugify(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`panelist-order-${event.id}`}>Sort order</Label>
                  <Input
                    id={`panelist-order-${event.id}`}
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((current) => ({ ...current, sort_order: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Publicly visible</p>
                <p className="text-xs text-muted-foreground">Use this as a kill switch before or during the event.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
            </div>

            {form.public_slug && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{panelistPublicBase}/{slugify(form.public_slug)}</span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => savePanelist.mutate()}
              disabled={savePanelist.isPending || !form.display_name.trim()}
            >
              {savePanelist.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPanelist ? 'Save Panelist' : 'Add Panelist'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {qrPanelist && (
        <PanelistQrDialog
          panelist={qrPanelist}
          url={`${panelistPublicBase}/${qrPanelist.public_slug}`}
          onClose={() => setQrPanelist(null)}
        />
      )}
    </section>
  );
};

const PanelistQrDialog: React.FC<{
  panelist: EventPanelist;
  url: string;
  onClose: () => void;
}> = ({ panelist, url, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = useState(false);

  const renderQr = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    if (!canvas) {
      setQrReady(false);
      return;
    }

    try {
      drawInlightQr(canvas, url);
      setQrReady(true);
    } catch {
      setQrReady(false);
      toast.error('Could not generate QR code.');
    }
  }, [url]);

  useEffect(() => {
    renderQr(canvasRef.current);
  }, [renderQr]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    toast.success('Panelist URL copied');
  };

  const downloadQr = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `inlight-${panelist.public_slug}-qr.png`;
    link.click();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[560px] overflow-y-auto overflow-x-hidden sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Panelist QR Code
          </DialogTitle>
          <DialogDescription>
            Inlight-branded QR code for {panelist.display_name}'s public Hot Seat profile.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-center text-white">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37] bg-black/40 font-display text-3xl italic shadow-[0_0_28px_rgba(212,175,55,0.28)]">
            i
          </div>
          <div className="relative mx-auto flex w-full max-w-[312px] items-center justify-center rounded-[22px] bg-white p-4 shadow-[0_24px_70px_rgba(46,70,255,0.28)]">
            <canvas
              ref={renderQr}
              width={360}
              height={360}
              className="aspect-square h-[280px] w-[280px] max-w-full shrink-0"
              aria-label={`QR code for ${panelist.display_name}`}
            />
            {!qrReady && (
              <div className="absolute inset-4 flex items-center justify-center rounded-lg bg-white text-sm font-medium text-slate-500">
                Generating QR...
              </div>
            )}
          </div>
          <p className="mt-4 font-display text-2xl font-semibold">{panelist.display_name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.28em] text-white/60">Scan to view profile</p>
        </div>

        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="truncate">{url}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" className="gap-2" onClick={copyUrl}>
            <Copy className="h-4 w-4" />
            Copy URL
          </Button>
          <Button className="gap-2" onClick={downloadQr}>
            <Download className="h-4 w-4" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const corner = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + corner, y);
  ctx.lineTo(x + width - corner, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + corner);
  ctx.lineTo(x + width, y + height - corner);
  ctx.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - corner);
  ctx.lineTo(x, y + corner);
  ctx.quadraticCurveTo(x, y, x + corner, y);
  ctx.closePath();
};

const drawFinderPattern = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  primaryColor: string,
  accentColor: string
) => {
  const outer = cellSize * 7;
  const middle = cellSize * 5;
  const inner = cellSize * 3;

  ctx.fillStyle = primaryColor;
  drawRoundedRect(ctx, x, y, outer, outer, cellSize * 1.4);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(2, cellSize * 0.36);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, x + cellSize, y + cellSize, middle, middle, cellSize * 0.95);
  ctx.fill();

  ctx.fillStyle = primaryColor;
  drawRoundedRect(ctx, x + cellSize * 2, y + cellSize * 2, inner, inner, cellSize * 0.72);
  ctx.fill();
};

const isFinderRegion = (row: number, col: number, size: number) => {
  const inTop = row < 8;
  const inBottom = row >= size - 8;
  const inLeft = col < 8;
  const inRight = col >= size - 8;

  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
};

const drawInlightQr = (canvas: HTMLCanvasElement, url: string) => {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const matrix = qr.modules;
  const size = matrix.size;
  const canvasSize = 360;
  const quietZone = 4;
  const totalCells = size + quietZone * 2;
  const cellSize = canvasSize / totalCells;
  const offset = quietZone * cellSize;
  const primaryColor = '#2E46FF';
  const darkColor = '#070B18';
  const accentColor = '#D4AF37';

  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!matrix.get(col, row) || isFinderRegion(row, col, size)) continue;

      const x = offset + col * cellSize;
      const y = offset + row * cellSize;
      const dotSize = cellSize * 0.76;
      const inset = (cellSize - dotSize) / 2;
      const isBrandDot = (row + col) % 7 === 0 || (row * col) % 17 === 0;

      ctx.fillStyle = isBrandDot ? primaryColor : darkColor;
      drawRoundedRect(ctx, x + inset, y + inset, dotSize, dotSize, dotSize * 0.38);
      ctx.fill();
    }
  }

  drawFinderPattern(ctx, offset, offset, cellSize, primaryColor, accentColor);
  drawFinderPattern(ctx, offset + (size - 7) * cellSize, offset, cellSize, primaryColor, accentColor);
  drawFinderPattern(ctx, offset, offset + (size - 7) * cellSize, cellSize, primaryColor, accentColor);

  const center = canvasSize / 2;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(center, center, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = darkColor;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic 700 40px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('i', center, center + 1);
  ctx.restore();
};

// QR Scanner Dialog
const QrScannerDialog: React.FC<{
  eventId: string;
  onClose: () => void;
}> = ({ eventId, onClose }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scanning, setScanning] = useState(true);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    name?: string;
  } | null>(null);
  const processingRef = useRef(false);

  const checkInTicket = async (ticketCode: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const { data: ticket, error: lookupError } = await supabase
        .from('tickets')
        .select('id, event_id, attendee_name, attendee_email, checked_in_at, status')
        .eq('ticket_code', ticketCode)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!ticket) {
        setLastResult({ success: false, message: 'Ticket not found' });
        return;
      }
      if (ticket.event_id !== eventId) {
        setLastResult({ success: false, message: 'Ticket is for a different event' });
        return;
      }
      if (ticket.checked_in_at) {
        setLastResult({
          success: false,
          message: 'Already checked in',
          name: ticket.attendee_name ?? undefined,
        });
        return;
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id,
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      setLastResult({
        success: true,
        message: 'Checked in successfully',
        name: ticket.attendee_name ?? undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['event-rsvps', eventId] });
      toast.success(`${ticket.attendee_name ?? 'Attendee'} checked in`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check-in failed';
      setLastResult({ success: false, message });
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 1500);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    // Wait one tick so the dialog content (and our container div) is mounted
    const timer = setTimeout(() => {
      if (cancelled || !containerRef.current) return;

      // Ensure the element has an id for html5-qrcode
      if (!containerRef.current.id) {
        containerRef.current.id = `qr-scanner-${Math.random().toString(36).slice(2, 9)}`;
      }

      try {
        scanner = new Html5Qrcode(containerRef.current.id);
        scannerRef.current = scanner;

        scanner
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              checkInTicket(decodedText.trim());
            },
            () => {
              // ignore per-frame decode errors
            }
          )
          .catch((err) => {
            setScanning(false);
            toast.error('Unable to access camera: ' + (err?.message ?? 'permission denied'));
          });
      } catch (err) {
        setScanning(false);
        const message = err instanceof Error ? err.message : 'unknown error';
        toast.error('Scanner failed to initialize: ' + message);
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {
              scannerRef.current = null;
            }
            scannerRef.current = null;
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Ticket QR
          </DialogTitle>
          <DialogDescription>
            Point your camera at an attendee's ticket QR code to check them in.
          </DialogDescription>
        </DialogHeader>

        <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
          <div ref={containerRef} className="w-full h-full" />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm p-4 text-center">
              Camera unavailable. Check browser permissions.
            </div>
          )}
        </div>

        {lastResult && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              lastResult.success
                ? 'bg-green-50 text-green-900 border border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-900'
                : 'bg-red-50 text-red-900 border border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900'
            }`}
          >
            {lastResult.success ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="font-medium">{lastResult.message}</div>
              {lastResult.name && <div className="text-xs opacity-80">{lastResult.name}</div>}
            </div>
          </div>
        )}

        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default EventsManager;
