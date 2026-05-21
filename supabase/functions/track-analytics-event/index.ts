import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedEvents = new Set([
  "page_view",
  "page_duration",
  "showcase_site_view",
  "showcase_profile_view",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const eventName = String(body.eventName || "");
    const path = String(body.path || "");
    const siteSlug = body.siteSlug ? String(body.siteSlug) : null;
    const visitorId = body.visitorId ? String(body.visitorId).slice(0, 128) : null;
    const referrer = body.referrer ? String(body.referrer).slice(0, 500) : null;
    const durationMs = Number.isFinite(Number(body.durationMs))
      ? Math.max(0, Math.min(Math.round(Number(body.durationMs)), 24 * 60 * 60 * 1000))
      : null;

    if (!allowedEvents.has(eventName) || !path || path.length > 500) {
      return new Response(
        JSON.stringify({ error: "Invalid analytics event" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await userClient.auth.getClaims(token);
      userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await serviceClient.from("analytics_events").insert({
      event_name: eventName,
      path: path.slice(0, 500),
      site_slug: siteSlug?.slice(0, 120) || null,
      visitor_id: visitorId,
      user_id: userId,
      referrer,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      duration_ms: durationMs,
    });

    if (error) {
      console.error("[track-analytics-event] insert failed", error);
      return new Response(
        JSON.stringify({ error: "Failed to record analytics event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ message: "Event recorded" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[track-analytics-event] failed", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
