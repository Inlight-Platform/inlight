import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    if (!webhookSecret) {
      console.error("[STRIPE-WEBHOOK] Missing STRIPE_WEBHOOK_SECRET");
      return new Response(JSON.stringify({ error: "Webhook secret is not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing Stripe signature" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    console.log(`[STRIPE-WEBHOOK] Event type: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const customerId = session.customer as string;
      const eventId = session.metadata?.event_id;

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Handle ticket purchases
      if (eventId && userId) {
        const amountPaid = (session.amount_total || 0) / 100;
        const { error: ticketError } = await supabase
          .from("tickets")
          .update({ status: "confirmed", amount_paid: amountPaid })
          .eq("stripe_session_id", session.id);

        if (ticketError) {
          console.error("[STRIPE-WEBHOOK] Ticket update error:", ticketError);
        } else {
          console.log(`[STRIPE-WEBHOOK] Ticket confirmed for event ${eventId}, user ${userId}`);
        }
      }

      // Handle plan upgrades (no event_id means it's a plan checkout)
      if (userId && !eventId) {
        const { error } = await supabase
          .from("profiles")
          .update({ plan_type: "pro", stripe_customer_id: customerId })
          .eq("user_id", userId);

        if (error) {
          console.error("[STRIPE-WEBHOOK] Profile update error:", error);
        } else {
          console.log(`[STRIPE-WEBHOOK] User ${userId} upgraded to pro`);
        }
      }

      // Handle Job Posting Payment Link purchases.
      // Stripe Payment Links forward `client_reference_id` (set in the URL by the
      // frontend) on the completed Checkout Session. Use it to credit the user.
      const clientRefId = session.client_reference_id;
      if (clientRefId && !eventId && !userId) {
        const { error: creditErr } = await supabase.rpc("increment_job_credit", {
          _user_id: clientRefId,
        });

        if (creditErr) {
          // Fallback: upsert manually if RPC doesn't exist
          const { data: existing } = await supabase
            .from("job_post_credits")
            .select("credits")
            .eq("user_id", clientRefId)
            .maybeSingle();

          const next = (existing?.credits ?? 0) + 1;
          const { error: upsertErr } = await supabase
            .from("job_post_credits")
            .upsert({ user_id: clientRefId, credits: next, updated_at: new Date().toISOString() });

          if (upsertErr) {
            console.error("[STRIPE-WEBHOOK] Job credit upsert error:", upsertErr);
          } else {
            console.log(`[STRIPE-WEBHOOK] Granted job credit to ${clientRefId} (total: ${next})`);
          }
        } else {
          console.log(`[STRIPE-WEBHOOK] Granted job credit to ${clientRefId} via RPC`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[STRIPE-WEBHOOK] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
