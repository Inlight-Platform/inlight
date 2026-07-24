import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://inlight.social";

function getSiteUrl() {
  return (Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

    const { email, projectId, roleName, note } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRole = String(roleName || "").trim();
    const normalizedProjectId = String(projectId || "").trim();
    const personalNote = typeof note === "string" ? note.trim() : "";

    if (!normalizedEmail || !normalizedProjectId || !normalizedRole) {
      return new Response(
        JSON.stringify({ error: "Email, project, and role are required" }),
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

    const { data: invite, error: inviteError } = await supabase.rpc("create_project_credit_invite", {
      _email: normalizedEmail,
      _project_id: normalizedProjectId,
      _role_name: normalizedRole,
    });

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: inviteError?.message || "Failed to create project invite" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: project } = await supabase
      .from("projects")
      .select("title")
      .eq("id", normalizedProjectId)
      .maybeSingle();

    const { data: senderProfile } = await supabase
      .from("profiles_public")
      .select("display_name")
      .eq("user_id", invite.inviter_id)
      .maybeSingle();

    const projectTitle = project?.title || invite.project_title || "an Inlight project";
    const senderName = senderProfile?.display_name || "An Inlight collaborator";
    const token = String(invite.token || "");

    // Send existing Inlight users to sign-in so they can claim the credit
    // immediately; send new recipients to sign-up.
    const { data: emailExists } = await supabase.rpc("check_email_exists_for_signup", {
      search_email: normalizedEmail,
    });
    const authMode = emailExists ? "signin" : "signup";
    const inviteUrl = `${getSiteUrl()}/auth?mode=${authMode}&credit_invite=${encodeURIComponent(token)}`;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const noteHtml = personalNote
      ? `<p style="margin:16px 0;padding:12px 14px;background:#f6f1e8;border-radius:8px;color:#3d3327;">${escapeHtml(personalNote)}</p>`
      : "";

    const { error: emailError } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [normalizedEmail],
      subject: `${senderName} invited you to claim credit on ${projectTitle}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717;max-width:560px;margin:0 auto;padding:32px 20px;">
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Claim your project credit</h1>
          <p style="margin:0 0 16px;">${escapeHtml(senderName)} invited you to claim your <strong>${escapeHtml(normalizedRole)}</strong> credit on <strong>${escapeHtml(projectTitle)}</strong>.</p>
          ${noteHtml}
          <p style="margin:24px 0;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">${emailExists ? "Sign in to claim credit" : "Create your account"}</a>
          </p>
          <p style="font-size:13px;color:#666;margin:24px 0 0;">If the button does not work, paste this link into your browser:<br>${escapeHtml(inviteUrl)}</p>
        </div>
      `,
    });

    if (emailError) {
      return new Response(
        JSON.stringify({ error: "Failed to send project invite email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ invite, inviteUrl }),
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
