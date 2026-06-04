import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = (Deno.env.get("SITE_URL") || "https://inlight.social").replace(/\/+$/, "");
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function esc(v: string) {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, email, token, inviter_name, project_title, role_name, personal_note } = body;
    if (!email || !type || !token) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
    }

    const inviter = esc(inviter_name || "Someone");
    let subject = "";
    let html = "";
    // Credit invites deep-link to the project page (with token), platform invites go to signup
    const acceptUrl =
      type === "credit" && body.project_id
        ? `${SITE_URL}/projects/${body.project_id}?credit_invite=${token}`
        : `${SITE_URL}/auth?mode=signup&${type === "credit" ? "credit_invite" : "invite"}=${token}`;

    if (type === "credit") {
      subject = `You've been invited to ${project_title || "a project"} on Inlight`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2>You've been invited to ${esc(project_title || "a project")}</h2>
          <p>${inviter} has invited you to claim your credit as <strong>${esc(role_name || "Collaborator")}</strong>.</p>
          <p>
            <a href="${acceptUrl}" style="display:inline-block;padding:12px 20px;background:#3B82F6;color:#fff;border-radius:8px;text-decoration:none;">
              Click here to review and claim your credit
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Or paste this link in your browser: ${acceptUrl}</p>
        </div>`;
    } else {
      subject = `${inviter_name || "Someone"} invited you to join Inlight`;
      const note = personal_note
        ? `<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555;">${esc(personal_note)}</blockquote>`
        : "";
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2>You've been invited to join Inlight by ${inviter}.</h2>
          ${note}
          <p>
            <a href="${acceptUrl}" style="display:inline-block;padding:12px 20px;background:#3B82F6;color:#fff;border-radius:8px;text-decoration:none;">
              Join Inlight
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Or paste this link in your browser: ${acceptUrl}</p>
        </div>`;
    }

    const { error } = await resend.emails.send({
      from: "Inlight <invites@inlight.social>",
      to: [email],
      subject,
      html,
    });
    if (error) {
      console.error("[send-invite-email] resend error:", error);
      // Fallback to onboarding sender if domain not verified
      const fallback = await resend.emails.send({
        from: "Inlight <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      });
      if (fallback.error) {
        return new Response(JSON.stringify({ error: fallback.error.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-invite-email] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});