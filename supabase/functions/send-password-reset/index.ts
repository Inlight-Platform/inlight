import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";
const DEFAULT_RESET_PATH = "/auth?mode=reset";
const DEFAULT_RESET_CONTINUE_PATH = "/auth/reset/continue";
const LOCAL_RESET_ORIGINS = new Set([
  "http://127.0.0.1:8081",
  "http://localhost:8081",
]);

function getRequestOrigin(req: Request) {
  const origin = req.headers.get("origin")?.replace(/\/+$/, "");
  return origin && LOCAL_RESET_ORIGINS.has(origin) ? origin : null;
}

function getSiteUrl(req: Request) {
  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) {
    return requestOrigin;
  }

  return (Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

function normalizeResetUrl(url: string) {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed.replace(/\/+$/, "")}${DEFAULT_RESET_PATH}`;
}

function getResetRedirectUrl(req: Request) {
  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) {
    return `${requestOrigin}${DEFAULT_RESET_PATH}`;
  }

  const configuredResetUrl = Deno.env.get("PASSWORD_RESET_REDIRECT_URL");
  if (configuredResetUrl) {
    return normalizeResetUrl(configuredResetUrl);
  }

  return `${getSiteUrl(req)}${DEFAULT_RESET_PATH}`;
}

function getResetContinueUrl(req: Request, actionLink: string) {
  const continueUrl = new URL(DEFAULT_RESET_CONTINUE_PATH, `${getSiteUrl(req)}/`);
  continueUrl.searchParams.set("confirmation_url", actionLink);
  return continueUrl.toString();
}

function buildEmailHtml(resetUrl: string) {
  return `
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
                  <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:20px;font-weight:600;">Reset Your Inlight Password</h2>
                  <p style="margin:0 0 16px;color:#4a4a68;font-size:14px;line-height:1.6;">
                    We received a request to reset the password for your Inlight account.
                  </p>
                  <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">
                    Click the button below to continue. On the next screen, confirm once more to set a new password. This link expires in 10 minutes.
                  </p>
                  <a href="${resetUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Reset Password</a>
                  <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6;">
                    If you did not request this, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const resetRedirectTo = getResetRedirectUrl(req);
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: resetRedirectTo,
      },
    });

    // Return a generic success response for unknown users to avoid email enumeration.
    if (linkError || !linkData?.properties?.action_link) {
      console.error("[send-password-reset] Failed generating recovery link:", linkError);
      const message = "If an account exists for that email, a reset link will be sent.";
      return new Response(
        JSON.stringify({ message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [email],
      subject: "Reset Your Inlight Password",
      html: buildEmailHtml(getResetContinueUrl(req, linkData.properties.action_link)),
    });

    if (emailError) {
      console.error("[send-password-reset] Resend error:", JSON.stringify(emailError));
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: "If an account exists for that email, a reset link will be sent." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-password-reset] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
