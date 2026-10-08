import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";
const DEFAULT_LOCAL_SITE_URL = "http://127.0.0.1:8080";

type BulkInviteResult = {
  accepted?: Array<{ email?: string }>;
  pending?: Array<{ email?: string; token?: string }>;
  invalid?: unknown[];
  duplicates?: unknown[];
  counts?: Record<string, number>;
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

  return hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "host.docker.internal";
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

async function sendLocalMailpitEmail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const configuredUrl = Deno.env.get("MAILPIT_API_URL") ||
    Deno.env.get("LOCAL_EMAIL_API_URL");
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

      if (response.ok) {
        return { sent: true, url };
      }

      lastError = `${url} returned ${response.status}: ${await response.text()}`;
    } catch (error) {
      lastError = `${url} failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { sent: false, error: lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { groupId, emails, note, membershipStatusOnAccept } = await req.json();
    const normalizedGroupId = String(groupId || "").trim();
    const emailList = Array.isArray(emails) ? emails.map((email) => String(email)) : [];
    const personalNote = typeof note === "string" ? note.trim() : "";
    const memberStatus = String(membershipStatusOnAccept || "active").trim().toLowerCase();

    if (!normalizedGroupId || emailList.length === 0) {
      return new Response(
        JSON.stringify({ error: "Group and at least one email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authorization },
        },
      }
    );

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id,name,slug")
      .eq("id", normalizedGroupId)
      .maybeSingle();

    if (groupError || !group) {
      return new Response(
        JSON.stringify({ error: groupError?.message || "Group not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase.rpc("create_group_member_invites", {
      _group_id: normalizedGroupId,
      _emails: emailList,
      _note: personalNote || null,
      _membership_status_on_accept: memberStatus || "active",
    });

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: error?.message || "Failed to create group invites" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data as BulkInviteResult;
    const pending = result.pending || [];
    const siteUrl = getSiteUrl();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const canUseLocalMailpit = isLocalUrl(siteUrl) ||
      isLocalSupabaseUrl(Deno.env.get("SUPABASE_URL"));
    const sent: Array<{ email: string; inviteUrl: string; localEmail?: boolean }> = [];
    const failed: Array<{ email: string; error: unknown }> = [];

    if (!resendApiKey && pending.length > 0 && !canUseLocalMailpit) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    for (const invite of pending) {
      const email = String(invite.email || "").trim().toLowerCase();
      const token = String(invite.token || "").trim();

      if (!email || !token) {
        failed.push({ email: email || "unknown", error: "Missing invite email or token" });
        continue;
      }

      const returnTo = `/groups/${group.slug}`;
      const inviteUrl =
        `${siteUrl}/auth?mode=signup&invite=${encodeURIComponent(token)}&group_invite=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`;
      const noteHtml = personalNote
        ? `<p style="margin:16px 0;padding:12px 14px;background:#f6f1e8;border-radius:8px;color:#3d3327;">${escapeHtml(personalNote)}</p>`
        : "";
      const subject = `You're invited to join ${group.name} on Inlight`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717;max-width:560px;margin:0 auto;padding:32px 20px;">
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Join ${escapeHtml(group.name)} on Inlight</h1>
          <p style="margin:0 0 16px;">A group admin invited you to join this private department portal.</p>
          ${noteHtml}
          <p style="margin:24px 0;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Create your account</a>
          </p>
          <p style="font-size:13px;color:#666;margin:24px 0 0;">If the button does not work, paste this link into your browser:<br>${escapeHtml(inviteUrl)}</p>
        </div>
      `;
      const text = [
        `Join ${group.name} on Inlight`,
        "",
        "A group admin invited you to join this private department portal.",
        personalNote,
        "",
        `Create your account: ${inviteUrl}`,
      ].filter(Boolean).join("\n");

      if (resend) {
        const { error: emailError } = await resend.emails.send({
          from: "Inlight <notifications@inlight.social>",
          to: [email],
          subject,
          html,
        });

        if (emailError) {
          failed.push({ email, error: emailError });
        } else {
          sent.push({ email, inviteUrl });
        }
      } else {
        const localEmail = await sendLocalMailpitEmail({ to: email, subject, html, text });

        if (!localEmail.sent) {
          failed.push({ email, error: localEmail.error });
        } else {
          sent.push({ email, inviteUrl, localEmail: true });
        }
      }
    }

    if (failed.length > 0) {
      return new Response(
        JSON.stringify({ result, emails: { sent, failed } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ result, emails: { sent, failed } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
