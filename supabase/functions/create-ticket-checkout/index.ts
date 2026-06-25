import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";

function getBaseUrl() {
  return (Deno.env.get("CHECKOUT_SITE_URL") || Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { event_id } = await req.json();
    if (!event_id) {
      throw new Error("Missing event_id");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: eventRecord, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, event_date, stripe_price_id, is_paid")
      .eq("id", event_id)
      .single();

    if (eventError || !eventRecord) {
      throw new Error("Event not found");
    }

    if (!eventRecord.is_paid) {
      throw new Error("This event is not configured for paid ticket checkout");
    }

    if (new Date(eventRecord.event_date).getTime() < Date.now()) {
      throw new Error("Tickets are closed for this past event");
    }

    if (!eventRecord.stripe_price_id) {
      throw new Error("Tickets are not yet available for this event");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: eventRecord.stripe_price_id, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/events/${event_id}?ticket=success`,
      cancel_url: `${origin}/events/${event_id}?ticket=cancelled`,
      metadata: { event_id, user_id: user.id },
    });

    // Create a pending ticket record
    await supabaseAdmin.from("tickets").insert({
      event_id,
      user_id: user.id,
      stripe_session_id: session.id,
      status: "pending",
      amount_paid: 0,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
