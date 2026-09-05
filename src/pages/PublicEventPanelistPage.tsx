import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Film, Globe, Instagram, Link as LinkIcon, MapPin, User } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VisitorAuthPrompt } from '@/components/auth/VisitorAuthPrompt';
import { eventPath, identifierFallbackUuid, isUuid } from '@/lib/publicPaths';
import { useAuth } from '@/hooks/useAuth';

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
};

type EventSummary = {
  id: string;
  title: string | null;
  description: string | null;
  event_date: string | null;
  event_type: string | null;
  image_url: string | null;
  location: string | null;
};

const resolveEventUuid = (eventId?: string) => {
  if (!eventId) return null;
  if (isUuid(eventId)) return eventId;
  return identifierFallbackUuid(eventId);
};

const getInstagramHandle = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@/, '');
  try {
    const url = new URL(withoutAt.startsWith('http') ? withoutAt : `https://${withoutAt}`);
    const pathHandle = url.pathname.split('/').filter(Boolean)[0];
    return pathHandle || url.hostname.replace(/^www\./, '').replace(/^instagram\.com\/?/, '');
  } catch {
    return withoutAt.replace(/^instagram\.com\//, '').split(/[/?#]/)[0] || null;
  }
};

const PublicEventPanelistPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { eventId, panelistSlug } = useParams<{ eventId: string; panelistSlug: string }>();
  const eventUuid = useMemo(() => resolveEventUuid(eventId), [eventId]);
  const [showProfileAuthPrompt, setShowProfileAuthPrompt] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['public-event-panelist', eventUuid, eventId, panelistSlug],
    queryFn: async () => {
      if (!panelistSlug) return null;

      let panelistQuery = supabase
        .from('event_panelists')
        .select('id, event_id, user_id, display_name, title, headline, location, bio, headshot_url, cover_url, website_url, instagram_url, reel_url, skills, badges, public_slug')
        .eq('public_slug', panelistSlug)
        .eq('is_active', true)
        .limit(1);

      if (eventUuid) {
        panelistQuery = panelistQuery.eq('event_id', eventUuid);
      }

      const { data: panelistRows, error: panelistError } = await panelistQuery;
      if (panelistError) throw panelistError;

      const panelist = (panelistRows?.[0] || null) as EventPanelist | null;
      if (!panelist) return null;

      const { data: event } = await supabase
        .from('events')
        .select('id, title, description, event_date, event_type, image_url, location')
        .eq('id', panelist.event_id)
        .maybeSingle();

      return {
        panelist,
        event: event as EventSummary | null,
      };
    },
    enabled: !!panelistSlug,
  });

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-4">
        <p className="text-muted-foreground">Loading panelist...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Panelist not found</p>
        <Button onClick={() => navigate('/feed?tab=events')}>Browse Events</Button>
      </main>
    );
  }

  const { panelist, event } = data;
  const displayName = panelist.display_name;
  const title = panelist.title;
  const bio = panelist.bio;
  const avatarUrl = panelist.headshot_url;
  const coverUrl = panelist.cover_url;
  const location = panelist.location || event?.location;
  const badges = panelist.badges || [];
  const websiteUrl = panelist.website_url;
  const instagramUrl = panelist.instagram_url;
  const instagramHandle = getInstagramHandle(instagramUrl);
  const roleLocationLine = title || location
    ? `${title || ''}${title && location ? ' based in ' : ''}${location || ''}`
    : panelist.headline || null;
  const backToEvent = event ? eventPath(event) : '/feed?tab=events';
  const inlightProfilePath = panelist.user_id ? `/profile/${panelist.user_id}` : null;
  const coverAlt = `${displayName} cover image`;

  const openInlightProfile = () => {
    if (!inlightProfilePath) return;
    if (user) {
      navigate(inlightProfilePath);
      return;
    }

    setShowProfileAuthPrompt(true);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" className="mb-6 gap-2">
        <Link to={backToEvent}>
          <ArrowLeft className="h-4 w-4" />
          Event
        </Link>
      </Button>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {coverUrl && (
          <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/25 via-background to-background sm:h-44">
            <img src={coverUrl} alt={coverAlt} className="h-full w-full object-contain" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/35 to-transparent" />
          </div>
        )}

        <div className="grid gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch lg:gap-8">
          <div className="order-2 min-w-0 text-center lg:order-1 lg:flex lg:flex-col lg:justify-center">
            <div className="flex w-full flex-col">
              <div className="order-2 space-y-4 lg:order-1">
                <h1 className="font-display text-4xl font-bold tracking-normal text-foreground sm:text-5xl">
                  {displayName}
                </h1>
                {instagramHandle && instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 text-sm italic hover:underline"
                    style={{ color: '#c2185b' }}
                  >
                    <Instagram className="h-3.5 w-3.5" style={{ color: '#ec4899' }} />
                    @{instagramHandle}
                  </a>
                )}
                {roleLocationLine && (
                  <p className="text-sm text-muted-foreground">
                    {roleLocationLine}
                  </p>
                )}
              </div>

              {badges.length > 0 && (
                <div className="order-3 mt-5 flex flex-wrap justify-center gap-2 lg:order-2">
                  {badges.slice(0, 8).map((badge) => (
                    <Badge key={badge} variant="secondary" className="rounded-full px-4 py-1.5 text-sm font-medium lowercase">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}

              {bio && (
                <p className="order-4 mx-auto mt-7 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-foreground lg:order-3">
                  {bio}
                </p>
              )}

              {event?.title && (
                <div className="order-5 mt-7 rounded-xl border border-border bg-background/70 p-4 text-left text-sm lg:hidden">
                  <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Panelist For</p>
                  <Link to={backToEvent} className="mt-1 block font-semibold text-foreground hover:text-primary">
                    {event.title}
                  </Link>
                  {event.event_date && (
                    <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      {format(new Date(event.event_date), 'EEE, MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
              )}

              <div className="order-4 mx-auto mt-8 hidden h-px w-full max-w-3xl bg-border lg:block" />

              <div className="order-1 mb-7 flex flex-wrap justify-center gap-3 lg:order-5 lg:mb-0 lg:mt-8">
                {inlightProfilePath && (
                  <Button className="gap-2" onClick={openInlightProfile}>
                    <User className="h-4 w-4" />
                    View Inlight Profile
                  </Button>
                )}
                {websiteUrl && (
                  <Button asChild variant="outline" className="gap-2">
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4" />
                      Website
                    </a>
                  </Button>
                )}
                {panelist.reel_url && (
                  <Button asChild variant="outline" className="gap-2">
                    <a href={panelist.reel_url} target="_blank" rel="noopener noreferrer">
                      <Film className="h-4 w-4" />
                      Reel
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="order-1 flex flex-col items-center gap-4 lg:order-2">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-[336px] w-[264px] rounded-2xl border border-border bg-background object-cover shadow-card sm:h-[390px] sm:w-[300px]"
              />
            ) : (
              <div className="flex h-[336px] w-[264px] items-center justify-center rounded-2xl border border-border bg-muted text-6xl font-semibold text-primary shadow-card sm:h-[390px] sm:w-[300px]">
                {displayName[0]?.toUpperCase() || 'P'}
              </div>
            )}

            {event?.title && (
              <div className="hidden w-full rounded-xl border border-border bg-background/70 p-4 text-sm lg:block">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Panelist For</p>
                <Link to={backToEvent} className="mt-1 block font-semibold text-foreground hover:text-primary">
                  {event.title}
                </Link>
                {event.event_date && (
                  <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    {format(new Date(event.event_date), 'EEE, MMM d, yyyy h:mm a')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {event && (
        <section className="mt-6 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Event</h2>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {event.event_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {format(new Date(event.event_date), 'EEE, MMM d, yyyy h:mm a')}
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {event.location}
              </div>
            )}
            {event.event_type && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {event.event_type}
              </div>
            )}
          </div>
          {event.description && <p className="mt-4 text-sm leading-6 text-foreground">{event.description}</p>}
          <Button asChild className="mt-5 gap-2">
            <Link to={backToEvent}>
              Open Event
              <LinkIcon className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      )}

      <Dialog open={showProfileAuthPrompt} onOpenChange={setShowProfileAuthPrompt}>
        <DialogContent className="z-[220] border-0 bg-transparent p-0 shadow-none sm:max-w-md [&>button]:hidden">
          <VisitorAuthPrompt
            compact
            title={`View ${displayName}'s full Inlight profile`}
            description="Sign in or create an account to open this panelist's complete Inlight profile and creative network context."
            features={['Full profile', 'Creative network']}
            returnTo={inlightProfilePath || undefined}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default PublicEventPanelistPage;
