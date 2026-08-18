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

    const { event_id, session_id } = await req.json();
    if (!event_id || !session_id) {
      throw new Error("Missing required fields: event_id, session_id");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.metadata?.event_id !== event_id || session.metadata?.user_id !== user.id) {
      throw new Error("Checkout session does not match this event purchase");
    }

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: ticket, error: ticketLookupError } = await supabaseAdmin
      .from("tickets")
      .select("id, ticket_code")
      .eq("event_id", event_id)
      .eq("user_id", user.id)
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (ticketLookupError) throw ticketLookupError;

    let ticketCode = ticket?.ticket_code ?? null;
    if (!ticketCode) {
      const { data: generatedCode, error: codeError } = await supabaseAdmin.rpc("generate_ticket_code");
      if (codeError) throw codeError;
      ticketCode = generatedCode;
    }

    if (ticket) {
      const { error: updateError } = await supabaseAdmin
        .from("tickets")
        .update({
          status: "confirmed",
          amount_paid: (session.amount_total || 0) / 100,
          attendee_email: user.email,
          ticket_code: ticketCode,
        })
        .eq("id", ticket.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ status: "confirmed", ticket_id: ticket.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: insertedTicket, error: insertError } = await supabaseAdmin
      .from("tickets")
      .insert({
        event_id,
        user_id: user.id,
        stripe_session_id: session.id,
        status: "confirmed",
        amount_paid: (session.amount_total || 0) / 100,
        attendee_email: user.email,
        ticket_code: ticketCode,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ status: "confirmed", ticket_id: insertedTicket.id }), {
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
