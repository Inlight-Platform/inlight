import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { event_id, price, currency } = await req.json();
    if (!event_id || !price || price <= 0) {
      throw new Error("Missing required fields: event_id, price");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: eventRecord, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, title, user_id, stripe_price_id")
      .eq("id", event_id)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventRecord || eventRecord.user_id !== user.id) {
      throw new Error("You do not have permission to configure tickets for this event");
    }

    if (eventRecord.stripe_price_id) {
      return new Response(JSON.stringify({ price_id: eventRecord.stripe_price_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Create Stripe product + price
    const product = await stripe.products.create({
      name: `Event Ticket: ${eventRecord.title}`,
      metadata: { event_id, created_by: user.id },
    });

    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price * 100),
      currency: currency || "usd",
    });

    const { error: updateError } = await supabaseAdmin
      .from("events")
      .update({ stripe_price_id: stripePrice.id })
      .eq("id", event_id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ price_id: stripePrice.id }), {
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
