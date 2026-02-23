import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();

    if (!record || !record.user_id) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to look up user email and email_notifications preference
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user profile to check email preference and get email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, email_notifications, display_name")
      .eq("user_id", record.user_id)
      .single();

    if (profileError || !profile) {
      console.error("Could not find profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Respect the user's email notification preference
    if (profile.email_notifications === false) {
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationType = record.type || "notification";
    const title = record.title || "New Notification";
    const body = record.body || "";
    const data = record.data || {};

    let emailSubject = title;
    let emailBody = "";

    if (notificationType === "message" && data.sender_id) {
      // Fetch sender's display name
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.sender_id)
        .single();

      const senderName = senderProfile?.display_name || "Someone";
      emailSubject = `New message from ${senderName}`;

      emailBody = `
        <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">You got a new message from ${senderName}!</h2>
        <a href="https://inlight.lovable.app/messages" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Respond</a>
      `;
    } else {
      emailBody = `
        <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${title}</h2>
        ${body ? `<p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${body}</p>` : ""}
        <a href="https://inlight.lovable.app" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View on Inlight</a>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background-color:#1a1a2e;padding:24px 32px;">
                    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Inlight</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    ${emailBody}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;border-top:1px solid #e4e4e7;">
                    <p style="margin:0;color:#a1a1aa;font-size:12px;">You received this because you have email notifications enabled. You can change this in your profile settings.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [profile.email],
      subject: emailSubject,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-notification-email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
