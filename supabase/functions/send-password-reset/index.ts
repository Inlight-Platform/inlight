import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";
const DEFAULT_RESET_PATH = "/auth?mode=reset";

function getSiteUrl() {
  return (Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

function normalizeResetUrl(url: string) {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed.replace(/\/+$/, "")}${DEFAULT_RESET_PATH}`;
}

function getResetRedirectUrl(redirectTo?: string) {
  const configuredResetUrl = Deno.env.get("PASSWORD_RESET_REDIRECT_URL");
  if (redirectTo) {
    return normalizeResetUrl(redirectTo);
  }

  if (configuredResetUrl) {
    return normalizeResetUrl(configuredResetUrl);
  }

  return `${getSiteUrl()}${DEFAULT_RESET_PATH}`;
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
                    Click the button below to set a new password. This link expires in 1 hour.
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
    const { email, redirectTo, debug } = await req.json();

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

    const resetRedirectTo = getResetRedirectUrl(redirectTo);
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
      const debugPayload = debug
        ? {
            message,
            debug: {
              stage: "generate_link",
              redirectTo: resetRedirectTo,
              linkError: linkError
                ? {
                    name: linkError.name,
                    message: linkError.message,
                    status: (linkError as { status?: number }).status ?? null,
                  }
                : null,
              hasActionLink: Boolean(linkData?.properties?.action_link),
            },
          }
        : { message };
      return new Response(
        JSON.stringify(debugPayload),
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
      html: buildEmailHtml(linkData.properties.action_link),
    });

    if (emailError) {
      console.error("[send-password-reset] Resend error:", JSON.stringify(emailError));
      const errorPayload = debug
        ? {
            error: "Failed to send email",
            debug: {
              stage: "send_email",
              redirectTo: resetRedirectTo,
              hasActionLink: true,
              emailError,
            },
          }
        : { error: "Failed to send email" };
      return new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const successPayload = debug
      ? {
          message: "If an account exists for that email, a reset link will be sent.",
          debug: {
            stage: "sent",
            redirectTo: resetRedirectTo,
            hasActionLink: true,
            emailId: emailData?.id ?? null,
          },
        }
      : { message: "If an account exists for that email, a reset link will be sent." };

    return new Response(
      JSON.stringify(successPayload),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-password-reset] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
