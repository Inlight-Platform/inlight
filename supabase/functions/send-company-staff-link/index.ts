import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getOriginFromUrl(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return Deno.env.get("SITE_URL") || "https://inlight.social";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, staffName, companyName, editUrl } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(staffName || "").trim();
    const normalizedCompany = String(companyName || "your company page").trim();
    const normalizedEditUrl = String(editUrl || "").trim();

    if (!normalizedEmail || !normalizedEditUrl || !normalizedCompany) {
      return new Response(JSON.stringify({ error: "Email, company name, and edit link are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: userErr?.message || "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminRole, error: roleError } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message || "Failed to verify admin role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteOrigin = getOriginFromUrl(normalizedEditUrl).replace(/\/+$/, "");
    let accountUrl = `${siteOrigin}/auth`;
    let accountInviteError: string | null = null;

    const { data: invite, error: inviteError } = await userClient.rpc("create_platform_invite", {
      _email: normalizedEmail,
      _note: `Staff access for ${normalizedCompany}`,
    });

    if (inviteError) {
      accountInviteError = inviteError.message || "Failed to create platform invite";
    } else {
      const token = typeof invite === "object" && invite && "token" in invite
        ? String((invite as { token?: unknown }).token || "")
        : "";
      const acceptedAt = typeof invite === "object" && invite && "accepted_at" in invite
        ? (invite as { accepted_at?: unknown }).accepted_at
        : null;
      if (token && !acceptedAt) {
        accountUrl = `${siteOrigin}/auth?mode=signup&invite=${encodeURIComponent(token)}`;
      }
    }

    const greeting = normalizedName ? `Hi ${escapeHtml(normalizedName)},` : "Hi,";
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [normalizedEmail],
      subject: `Edit access for ${normalizedCompany} on Inlight`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717;max-width:560px;margin:0 auto;padding:32px 20px;">
          <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px;">${escapeHtml(normalizedCompany)} edit access</h1>
          <p style="margin:0 0 16px;">${greeting}</p>
          <p style="margin:0 0 20px;">An Inlight admin created an editable company page for <strong>${escapeHtml(normalizedCompany)}</strong>. Use the private link below to update the page details and media.</p>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(normalizedEditUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Edit company page</a>
          </p>
          <div style="background:#f7f4ee;border:1px solid #e6dccb;border-radius:10px;padding:14px;margin:22px 0;">
            <p style="margin:0 0 8px;"><strong>Recommended next step</strong></p>
            <p style="margin:0 0 14px;">Create or sign in to an Inlight account so future company access can live with your own login. The edit link above will still work for this company page.</p>
            <a href="${escapeHtml(accountUrl)}" style="display:inline-block;color:#171717;font-weight:600;">Create or sign in to Inlight</a>
          </div>
          <p style="font-size:13px;color:#666;margin:24px 0 0;">If the button does not work, paste this link into your browser:<br>${escapeHtml(normalizedEditUrl)}</p>
        </div>
      `,
    });

    if (error) {
      const details = typeof error === "object" && error
        ? error
        : { message: String(error) };
      return new Response(JSON.stringify({ error: "Failed to send email", details }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Email sent", id: data?.id, account_invite_error: accountInviteError }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
