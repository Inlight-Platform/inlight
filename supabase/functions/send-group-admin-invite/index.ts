import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";
const DEFAULT_LOCAL_SITE_URL = "http://127.0.0.1:8080";

type AdminInvite = {
  email: string;
  status: string;
  existing_user: boolean;
  token?: string;
  group_name: string;
  group_slug: string;
};

function getUrlHost(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function isLocalUrl(value: string | undefined) {
  const hostname = getUrlHost(value);
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "host.docker.internal";
}

function isLocalSupabaseUrl(value: string | undefined) {
  const hostname = getUrlHost(value);
  return isLocalUrl(value) || hostname === "kong" || hostname?.startsWith("supabase_kong");
}

function getSiteUrl() {
  const configuredSiteUrl = Deno.env.get("SITE_URL");
  if (!configuredSiteUrl && isLocalSupabaseUrl(Deno.env.get("SUPABASE_URL"))) {
    return DEFAULT_LOCAL_SITE_URL;
  }
  return (configuredSiteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendLocalMailpitEmail(message: { to: string; subject: string; html: string; text: string }) {
  const configuredUrl = Deno.env.get("MAILPIT_API_URL") || Deno.env.get("LOCAL_EMAIL_API_URL");
  const urls = [
    configuredUrl,
    "http://host.docker.internal:54324/api/v1/send",
    "http://127.0.0.1:54324/api/v1/send",
  ].filter(Boolean) as string[];
  let lastError = "Mailpit API is unavailable";

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: "notifications@inlight.social", Name: "Inlight" },
          To: [{ Email: message.to }],
          Subject: message.subject,
          HTML: message.html,
          Text: message.text,
        }),
      });
      if (response.ok) return { sent: true };
      lastError = `${url} returned ${response.status}: ${await response.text()}`;
    } catch (error) {
      lastError = `${url} failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { sent: false, error: lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { groupId, email, note } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const personalNote = typeof note === "string" ? note.trim() : "";

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data, error } = await supabase.rpc("create_group_admin_invite", {
      _group_id: String(groupId || "").trim(),
      _email: normalizedEmail,
      _note: personalNote || null,
    });

    if (error || !data) {
      return new Response(JSON.stringify({ error: error?.message || "Failed to create admin invite" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invite = data as AdminInvite;
    if (invite.existing_user) {
      return new Response(JSON.stringify({ invite, email: { sent: false, notRequired: true } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite.token) {
      return new Response(JSON.stringify({ invite, email: { sent: false, error: "Missing invite token" } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = getSiteUrl();
    const returnTo = `/groups/${invite.group_slug}`;
    const inviteUrl = `${siteUrl}/auth?mode=signup&invite=${encodeURIComponent(invite.token)}&returnTo=${encodeURIComponent(returnTo)}`;
    const subject = `You're invited to administer ${invite.group_name} on Inlight`;
    const noteHtml = personalNote
      ? `<p style="margin:16px 0;padding:12px 14px;background:#f6f1e8;border-radius:8px;color:#3d3327;">${escapeHtml(personalNote)}</p>`
      : "";
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717;max-width:560px;margin:0 auto;padding:32px 20px;">
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Administer ${escapeHtml(invite.group_name)} on Inlight</h1>
        <p style="margin:0 0 16px;">You've been invited to manage this department portal.</p>
        ${noteHtml}
        <p style="margin:24px 0;"><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Create your account</a></p>
        <p style="font-size:13px;color:#666;margin:24px 0 0;">If the button does not work, paste this link into your browser:<br>${escapeHtml(inviteUrl)}</p>
      </div>`;
    const text = [
      `Administer ${invite.group_name} on Inlight`,
      "",
      "You've been invited to manage this department portal.",
      personalNote,
      "",
      `Create your account: ${inviteUrl}`,
    ].filter(Boolean).join("\n");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      if (!isLocalUrl(siteUrl) && !isLocalSupabaseUrl(Deno.env.get("SUPABASE_URL"))) {
        return new Response(JSON.stringify({ invite, email: { sent: false, error: "Missing RESEND_API_KEY" } }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const localEmail = await sendLocalMailpitEmail({ to: invite.email, subject, html, text });
      return new Response(JSON.stringify({ invite, inviteUrl, email: localEmail }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [invite.email],
      subject,
      html,
    });
    return new Response(JSON.stringify({
      invite,
      inviteUrl,
      email: emailError ? { sent: false, error: emailError } : { sent: true },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
