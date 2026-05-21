import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_SUPABASE_URL = 'https://piofmmawwnermvaysonw.supabase.co';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const VISITOR_ID_KEY = 'inlight_analytics_visitor_id';

type AnalyticsEventName = 'page_view' | 'showcase_site_view' | 'showcase_profile_view';

interface TrackPageViewOptions {
  eventName: AnalyticsEventName;
  siteSlug?: string | null;
  path?: string;
  enabled?: boolean;
  trackDuration?: boolean;
}

const getVisitorId = () => {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const visitorId = crypto.randomUUID();
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
};

export const useTrackPageView = ({
  eventName,
  siteSlug,
  path,
  enabled = true,
  trackDuration = false,
}: TrackPageViewOptions) => {
  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    const trackedPath = path || window.location.pathname;

    const buildPayload = (durationMs?: number) => ({
      eventName: typeof durationMs === 'number' ? 'page_duration' : eventName,
      siteSlug,
      path: trackedPath,
      referrer: document.referrer || null,
      visitorId: getVisitorId(),
      durationMs,
    });

    const track = async (durationMs?: number, useBeacon = false) => {
      try {
        if (typeof durationMs === 'number') {
          const body = JSON.stringify(buildPayload(durationMs));
          if (useBeacon && navigator.sendBeacon) {
            navigator.sendBeacon(
              `${SUPABASE_URL}/functions/v1/track-analytics-event`,
              new Blob([body], { type: 'application/json' })
            );
            return;
          }

          await fetch(`${SUPABASE_URL}/functions/v1/track-analytics-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: useBeacon,
          });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        await fetch(`${SUPABASE_URL}/functions/v1/track-analytics-event`, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildPayload()),
        });
      } catch (error) {
        console.error('Error tracking analytics event:', error);
      }
    };

    track();

    if (!trackDuration) return;

    let durationSent = false;
    let lastDurationSentAt = startedAt;
    const sendDuration = (useBeacon = false) => {
      const now = Date.now();
      const durationMs = now - lastDurationSentAt;
      if (durationMs >= 1000) {
        lastDurationSentAt = now;
        void track(durationMs, useBeacon);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        durationSent = true;
        sendDuration(true);
      }
    };

    const handlePageHide = () => {
      durationSent = true;
      sendDuration(true);
    };

    const firstDurationTimer = window.setTimeout(() => sendDuration(false), 2000);
    const durationInterval = window.setInterval(() => sendDuration(false), 10000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearTimeout(firstDurationTimer);
      window.clearInterval(durationInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      if (!durationSent) {
        durationSent = true;
        sendDuration(true);
      }
    };
  }, [eventName, siteSlug, path, enabled, trackDuration]);
};
