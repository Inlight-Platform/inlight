import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) throw new Error("Missing ticket_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Load ticket + event
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, ticket_code, attendee_name, attendee_email, user_id, event_id, amount_paid, status")
      .eq("id", ticket_id)
      .maybeSingle();

    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "confirmed") {
      return new Response(JSON.stringify({ skipped: "not confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("title, description, event_date, location, image_url")
      .eq("id", ticket.event_id)
      .maybeSingle();

    if (eventErr) throw eventErr;
    if (!event) throw new Error("Event not found");

    // Resolve recipient email
    let recipientEmail = ticket.attendee_email;
    let recipientName = ticket.attendee_name ?? "Friend";
    if (!recipientEmail && ticket.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", ticket.user_id)
        .maybeSingle();
      recipientEmail = profile?.email ?? null;
      recipientName = profile?.display_name ?? recipientName;
    }
    if (!recipientEmail) throw new Error("No recipient email available");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const ticketCode = ticket.ticket_code ?? "";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(ticketCode)}`;
    const eventDate = new Date(event.event_date);
    const formattedDate = eventDate.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const amountLine = ticket.amount_paid && ticket.amount_paid > 0
      ? `<p style="margin:8px 0;color:#555;font-size:14px;"><strong>Paid:</strong> $${Number(ticket.amount_paid).toFixed(2)}</p>`
      : `<p style="margin:8px 0;color:#555;font-size:14px;"><strong>Free RSVP</strong></p>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#0a0e1a;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:22px;letter-spacing:0.5px;">Inlight</h1>
      <p style="margin:6px 0 0;opacity:0.8;font-size:13px;">Your ticket is confirmed</p>
    </div>
    <div style="background:#ffffff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="margin:0 0 4px;font-size:20px;color:#0a0e1a;">${escapeHtml(event.title)}</h2>
      <p style="margin:0 0 16px;color:#666;font-size:14px;">${escapeHtml(formattedDate)}</p>
      ${event.location ? `<p style="margin:0 0 16px;color:#666;font-size:14px;">📍 ${escapeHtml(event.location)}</p>` : ""}
      <p style="margin:16px 0 8px;color:#222;">Hi ${escapeHtml(recipientName)},</p>
      <p style="margin:0 0 20px;color:#444;font-size:14px;line-height:1.5;">
        Thanks for getting your ticket. Show this QR code at the door — our team will scan it to check you in.
      </p>
      <div style="text-align:center;margin:24px 0;padding:20px;background:#f5f5f7;border-radius:8px;">
        <img src="${qrUrl}" alt="Ticket QR code" width="240" height="240" style="display:block;margin:0 auto;border-radius:6px;background:#fff;padding:8px;" />
        <p style="margin:12px 0 0;font-family:'SF Mono',Menlo,monospace;font-size:12px;color:#666;letter-spacing:1px;">${escapeHtml(ticketCode)}</p>
      </div>
      ${amountLine}
      <p style="margin:24px 0 0;color:#999;font-size:12px;text-align:center;">
        This QR code is unique to your ticket. Don't share it.
      </p>
    </div>
    <p style="text-align:center;color:#999;font-size:11px;margin-top:16px;">
      © Inlight · inlight.social
    </p>
  </div>
</body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Inlight <tickets@inlight.social>",
        to: [recipientEmail],
        subject: `Your ticket: ${event.title}`,
        html,
      }),
    });

    const resendBody = await resendRes.json();
    if (!resendRes.ok) {
      console.error("Resend error:", resendBody);
      throw new Error(resendBody?.message ?? "Resend failed");
    }

    console.log(`[send-ticket-email] sent to ${recipientEmail} for ticket ${ticket_id}`);

    return new Response(JSON.stringify({ ok: true, id: resendBody?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[send-ticket-email] error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
