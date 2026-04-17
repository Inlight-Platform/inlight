import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, displayName, programName } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(RESEND_API_KEY);
    const firstName = (displayName || "there").split(" ")[0];
    const program = programName || "your program";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#1a1a2e;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">Welcome to Inlight</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:20px;font-weight:600;">Hey ${firstName} 👋</h2>
          <p style="margin:0 0 20px;color:#4a4a68;font-size:15px;line-height:1.6;">
            Your <strong>${program}</strong> showcase profile is live — but that's just the start. You now have full access to Inlight, the network for the next generation of entertainment professionals.
          </p>
          <p style="margin:0 0 16px;color:#1a1a2e;font-size:15px;font-weight:600;">A few things to do next:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f3;">
              <a href="https://inlight.social/profile" style="color:#1a1a2e;text-decoration:none;font-size:14px;">
                <strong style="color:#6366f1;">①</strong> &nbsp; Complete your profile (bio, headshot, role)
              </a>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f3;">
              <a href="https://inlight.social/profile" style="color:#1a1a2e;text-decoration:none;font-size:14px;">
                <strong style="color:#6366f1;">②</strong> &nbsp; Add your credits and past projects
              </a>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f3;">
              <a href="https://inlight.social/people" style="color:#1a1a2e;text-decoration:none;font-size:14px;">
                <strong style="color:#6366f1;">③</strong> &nbsp; Connect with classmates and collaborators
              </a>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f3;">
              <a href="https://inlight.social/opportunities" style="color:#1a1a2e;text-decoration:none;font-size:14px;">
                <strong style="color:#6366f1;">④</strong> &nbsp; Explore jobs and open roles
              </a>
            </td></tr>
            <tr><td style="padding:10px 0;">
              <a href="https://inlight.social/events" style="color:#1a1a2e;text-decoration:none;font-size:14px;">
                <strong style="color:#6366f1;">⑤</strong> &nbsp; Discover upcoming industry events
              </a>
            </td></tr>
          </table>
          <a href="https://inlight.social/feed" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Explore Inlight →</a>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.6;">
            We'll walk you through everything on your first visit — no need to figure it out alone.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">Inlight — the network for the next generation of entertainment.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [email],
      subject: `Welcome to Inlight, ${firstName} — your showcase is live`,
      html,
    });

    if (error) {
      console.error("[send-showcase-welcome] Resend error:", error);
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Sent", id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-showcase-welcome] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
