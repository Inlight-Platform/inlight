// Sends a branded ticket receipt email with embedded QR code (PNG attachment + cid).
// Triggered manually from the Stripe webhook (paid) and the free-RSVP trigger fallback path.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://inlight.social";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "Missing ticket_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load ticket
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, ticket_code, event_id, user_id, attendee_name, attendee_email, amount_paid, source")
      .eq("id", ticket_id)
      .single();

    if (tErr || !ticket) {
      console.error("[send-ticket-email] ticket not found", tErr);
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load event
    const { data: event } = await supabase
      .from("events")
      .select("title, event_date, location, image_url")
      .eq("id", ticket.event_id)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve recipient
    let recipientEmail = ticket.attendee_email as string | null;
    let recipientName = ticket.attendee_name as string | null;

    if (!recipientEmail && ticket.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", ticket.user_id)
        .single();
      recipientEmail = profile?.email ?? null;
      recipientName = recipientName ?? profile?.display_name ?? null;
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "No recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate QR code as PNG buffer
    const verifyUrl = `${APP_URL}/verify-ticket/${ticket.ticket_code}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 320,
      margin: 1,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    });
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");

    // Format event date
    const eventDate = new Date(event.event_date);
    const dateStr = eventDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resend = new Resend(RESEND_API_KEY);

    const html = buildTicketEmailHtml({
      eventTitle: event.title,
      dateStr,
      timeStr,
      location: event.location ?? "TBA",
      attendeeName: recipientName ?? "Guest",
      ticketCode: ticket.ticket_code as string,
      amountPaid: Number(ticket.amount_paid ?? 0),
      isPaid: ticket.source === "paid",
    });

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: "Inlight Tickets <tickets@inlight.social>",
      to: [recipientEmail],
      subject: `🎟️ Your ticket for ${event.title}`,
      html,
      attachments: [
        {
          filename: "ticket-qr.png",
          content: qrBase64,
          contentId: "ticketqr",
        } as any,
      ],
    });

    if (emailErr) {
      console.error("[send-ticket-email] Resend error", emailErr);
      return new Response(JSON.stringify({ error: "Email send failed", details: emailErr }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[send-ticket-email] sent", emailData?.id);
    return new Response(JSON.stringify({ ok: true, id: emailData?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-ticket-email] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildTicketEmailHtml(opts: {
  eventTitle: string;
  dateStr: string;
  timeStr: string;
  location: string;
  attendeeName: string;
  ticketCode: string;
  amountPaid: number;
  isPaid: boolean;
}) {
  const priceRow = opts.isPaid
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Paid</td><td style="padding:6px 0;text-align:right;color:#1a1a2e;font-weight:600;font-size:13px;">$${opts.amountPaid.toFixed(2)}</td></tr>`
    : `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Type</td><td style="padding:6px 0;text-align:right;color:#1a1a2e;font-weight:600;font-size:13px;">Free RSVP</td></tr>`;

  return `
  <!DOCTYPE html>
  <html><head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#2d3561 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Inlight</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Your ticket is confirmed</p>
          </td></tr>
          <tr><td style="padding:32px;">
            <h2 style="margin:0 0 6px;color:#1a1a2e;font-size:24px;font-weight:700;">${escapeHtml(opts.eventTitle)}</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${escapeHtml(opts.dateStr)} · ${escapeHtml(opts.timeStr)}</p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Attendee</td><td style="padding:6px 0;text-align:right;color:#1a1a2e;font-weight:600;font-size:13px;">${escapeHtml(opts.attendeeName)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Location</td><td style="padding:6px 0;text-align:right;color:#1a1a2e;font-weight:600;font-size:13px;">${escapeHtml(opts.location)}</td></tr>
                ${priceRow}
                <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Ticket ID</td><td style="padding:6px 0;text-align:right;color:#1a1a2e;font-weight:600;font-size:11px;font-family:monospace;">${escapeHtml(opts.ticketCode.slice(0, 12))}…</td></tr>
              </table>
            </div>

            <div style="text-align:center;background:#ffffff;border:2px dashed #1a1a2e;border-radius:12px;padding:24px;">
              <p style="margin:0 0 12px;color:#1a1a2e;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Present at the door</p>
              <img src="cid:ticketqr" alt="Ticket QR Code" style="width:240px;height:240px;display:block;margin:0 auto;" />
              <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">Scan this code at check-in for entry.</p>
            </div>

            <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">Questions? Reply to this email or visit <a href="${APP_URL}" style="color:#6366f1;text-decoration:none;">inlight.social</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
