// Verifies a ticket QR scan. Only event creator or admin may scan.
// Action: 'lookup' returns details without check-in; 'check_in' marks the ticket as used.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ status: "error", message: "Authentication required" }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) {
      return json({ status: "error", message: "Invalid session" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json();
    const ticketCode: string | undefined = body?.ticket_code;
    const action: "lookup" | "check_in" = body?.action ?? "check_in";
    const expectedEventId: string | undefined = body?.event_id;

    if (!ticketCode || typeof ticketCode !== "string") {
      return json({ status: "invalid", message: "Ticket not found" }, 200);
    }

    // Use service role for the actual look-up + update
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // If QR encoded a URL, extract the code
    const code = extractCode(ticketCode);

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select(
        "id, ticket_code, event_id, user_id, attendee_name, attendee_email, attendee_role, status, checked_in_at, source",
      )
      .eq("ticket_code", code)
      .maybeSingle();

    if (tErr) {
      console.error("[verify-ticket] lookup error", tErr);
      return json({ status: "error", message: "Lookup failed" }, 500);
    }
    if (!ticket) {
      return json({ status: "invalid", message: "Ticket not found" }, 200);
    }

    if (expectedEventId && ticket.event_id !== expectedEventId) {
      return json({ status: "invalid", message: "Ticket is for a different event" }, 200);
    }

    // Permission check: must be event creator or admin
    const { data: evt } = await admin
      .from("events")
      .select("id, user_id, title, event_date")
      .eq("id", ticket.event_id)
      .single();

    if (!evt) {
      return json({ status: "error", message: "Event not found" }, 404);
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;
    const isCreator = evt.user_id === userId;

    if (!isCreator && !isAdmin) {
      return json({ status: "error", message: "Not authorized to scan this event" }, 403);
    }

    // Resolve attendee display info from profile if linked to a user
    let displayName = ticket.attendee_name ?? "Guest";
    let displayRole = ticket.attendee_role ?? null;
    if (ticket.user_id) {
      const { data: prof } = await admin
        .from("profiles")
        .select("display_name, role")
        .eq("user_id", ticket.user_id)
        .maybeSingle();
      if (prof) {
        displayName = prof.display_name || displayName;
        displayRole = prof.role || displayRole;
      }
    }

    // Lookup-only mode
    if (action === "lookup") {
      return json({
        status: ticket.checked_in_at ? "already_used" : "valid",
        ticket: {
          id: ticket.id,
          name: displayName,
          role: displayRole,
          email: ticket.attendee_email,
          event_title: evt.title,
          checked_in_at: ticket.checked_in_at,
        },
      });
    }

    // Already checked in?
    if (ticket.checked_in_at) {
      return json({
        status: "already_used",
        message: "Ticket already used",
        ticket: {
          id: ticket.id,
          name: displayName,
          role: displayRole,
          checked_in_at: ticket.checked_in_at,
        },
      });
    }

    // Perform check-in
    const { error: updErr } = await admin
      .from("tickets")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: userId,
        status: "checked_in",
      })
      .eq("id", ticket.id);

    if (updErr) {
      console.error("[verify-ticket] update error", updErr);
      return json({ status: "error", message: "Could not check in ticket" }, 500);
    }

    return json({
      status: "valid",
      message: "Checked in",
      ticket: {
        id: ticket.id,
        name: displayName,
        role: displayRole,
        email: ticket.attendee_email,
        event_title: evt.title,
      },
    });
  } catch (err) {
    console.error("[verify-ticket] error", err);
    return json({ status: "error", message: String(err) }, 500);
  }
});

function extractCode(input: string): string {
  const trimmed = input.trim();
  // Accept either a full URL like inlight.social/verify-ticket/<code> or the raw code
  const match = trimmed.match(/verify-ticket\/([a-f0-9]+)/i);
  if (match) return match[1];
  return trimmed;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
