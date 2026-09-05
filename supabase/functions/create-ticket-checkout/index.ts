import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

function getBaseUrl(req: Request) {
  const configuredUrl = Deno.env.get("CHECKOUT_SITE_URL") || Deno.env.get("SITE_URL");
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const requestOrigin = req.headers.get("origin");
  if (requestOrigin && LOCAL_ORIGIN_PATTERN.test(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, "");
  }

  return DEFAULT_SITE_URL;
}

async function generateTicketCode(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data, error } = await supabaseAdmin.rpc("generate_ticket_code");
  if (error) throw error;
  return data as string;
}

async function getBuyerName(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  stripeName: string | null | undefined
) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  return profile?.display_name || stripeName || null;
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

    const origin = getBaseUrl(req);
    const successUrl = `${origin}/events/${event_id}?ticket=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/events/${event_id}?ticket=cancelled`;

    const { data: confirmedTicket } = await supabaseAdmin
      .from("tickets")
      .select("id")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .in("status", ["confirmed", "partially_refunded"])
      .limit(1)
      .maybeSingle();

    if (confirmedTicket) {
      return new Response(JSON.stringify({ status: "confirmed", ticket_id: confirmedTicket.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: pendingTicket } = await supabaseAdmin
      .from("tickets")
      .select("id, stripe_session_id")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .not("stripe_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingTicket?.stripe_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(pendingTicket.stripe_session_id);
      if (existingSession.payment_status === "paid") {
        const ticketCode = await generateTicketCode(supabaseAdmin);
        const stripeEmail = existingSession.customer_details?.email ?? user.email ?? null;
        const buyerName = await getBuyerName(supabaseAdmin, user.id, existingSession.customer_details?.name);
        const paymentIntentId =
          typeof existingSession.payment_intent === "string"
            ? existingSession.payment_intent
            : existingSession.payment_intent?.id ?? null;
        const { error: confirmError } = await supabaseAdmin
          .from("tickets")
          .update({
            status: "confirmed",
            amount_paid: (existingSession.amount_total || 0) / 100,
            attendee_email: stripeEmail,
            attendee_name: buyerName,
            ticket_code: ticketCode,
            stripe_customer_email: stripeEmail,
            stripe_payment_intent_id: paymentIntentId,
            refunded_amount: 0,
            refunded_at: null,
            expired_at: null,
          })
          .eq("id", pendingTicket.id);

        if (confirmError) throw confirmError;

        return new Response(JSON.stringify({ status: "confirmed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (existingSession.status === "open" && existingSession.url && existingSession.success_url === successUrl) {
        return new Response(JSON.stringify({ url: existingSession.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: eventRecord.stripe_price_id, quantity: 1 }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { event_id, user_id: user.id },
    });

    const ticketPayload = {
      event_id,
      user_id: user.id,
      stripe_session_id: session.id,
      status: "pending",
      amount_paid: 0,
      attendee_email: user.email,
      stripe_customer_email: user.email,
      refunded_amount: 0,
    };

    const { error: ticketError } = pendingTicket?.id
      ? await supabaseAdmin.from("tickets").update(ticketPayload).eq("id", pendingTicket.id)
      : await supabaseAdmin.from("tickets").insert(ticketPayload);

    if (ticketError) throw ticketError;

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
