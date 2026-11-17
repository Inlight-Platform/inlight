import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

function assertInternalSecret(req: Request) {
  const expected = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
  if (!expected) {
    throw new Error("Missing NOTIFICATION_WEBHOOK_SECRET");
  }

  const provided = req.headers.get("x-internal-webhook-secret");
  if (provided !== expected) {
    throw new Error("Unauthorized");
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getJoinedProjectTitle(value: unknown): string | undefined {
  return isRecordObject(value) && typeof value.title === "string"
    ? value.title
    : undefined;
}

function isBranchDataMalformed(type: string, d: Record<string, unknown>): boolean {
  const malformedString = (value: unknown) => Boolean(value) && typeof value !== "string";
  switch (type) {
    case "message":
    case "connection_request":
      return malformedString(d.sender_id);
    case "application":
      return [d.applicant_id, d.project_id, d.role_id, d.application_id].some(malformedString);
    case "invitation":
      return [d.sender_id, d.role_id, d.role_name, d.project_title, d.project_id].some(malformedString);
    case "application_accepted":
      return [d.sender_id, d.project_id, d.role_name, d.project_title].some(malformedString);
    case "job_match":
      return malformedString(d.opportunity_id) || malformedString(d.opportunity_title) ||
        (Boolean(d.matched_roles) && (!Array.isArray(d.matched_roles) || !d.matched_roles.every((role: unknown) => typeof role === "string")));
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    assertInternalSecret(req);

    if (Deno.env.get("NOTIFICATION_EMAILS_ENABLED") === "false") {
      console.log("[send-notification-email] Global kill-switch active - email suppressed");
      return new Response(
        JSON.stringify({ message: "Notification emails disabled globally" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { record } = await req.json();
    console.log("[send-notification-email] Received record:", JSON.stringify(record));

    if (!record || !record.user_id) {
      console.error("[send-notification-email] Invalid payload - missing record or user_id");
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, email_notifications, display_name")
      .eq("user_id", record.user_id)
      .maybeSingle();

    if (profileError) {
      console.warn("[send-notification-email] Profile lookup failed, falling back to auth user:", profileError);
    }

    let recipientEmail = profileError ? "" : profile?.email || "";
    let emailNotifications = profileError ? undefined : profile?.email_notifications;
    if (!recipientEmail) {
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(record.user_id);
      if (authUserError || !authUser.user?.email) {
        console.error("[send-notification-email] Recipient email not found:", authUserError);
        return new Response(
          JSON.stringify({ error: "Recipient email not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      recipientEmail = authUser.user.email;
      emailNotifications = emailNotifications ?? true;
    }

    console.log("[send-notification-email] Recipient:", recipientEmail, "| email_notifications:", emailNotifications);

    if (emailNotifications === false) {
      console.log("[send-notification-email] Email notifications disabled for user");
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationType = record.type || "notification";
    const title = String(record.title || "New Notification");
    const body = String(record.body || "");
    const rawData: unknown = record.data || {};
    const data: Record<string, unknown> = isRecordObject(rawData) ? rawData : {};

    console.log("[send-notification-email] Notification type:", notificationType, "| title:", title);

    const { emailSubject, emailBody } = await buildEmailContent(
      supabase, notificationType, title, body, data, getSiteUrl()
    );

    const html = wrapEmailTemplate(emailBody);

    // Send via Resend directly
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("[send-notification-email] RESEND_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(RESEND_API_KEY);

    console.log("[send-notification-email] Sending email to:", recipientEmail, "| subject:", emailSubject);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [recipientEmail],
      subject: emailSubject,
      html,
    });

    if (emailError) {
      console.error("[send-notification-email] Resend error:", JSON.stringify(emailError));
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-notification-email] Email sent successfully! ID:", emailData?.id);
    return new Response(
      JSON.stringify({ message: "Email sent", id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-notification-email] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Email content builders ---

type NotificationClient = SupabaseClient;

async function buildEmailContent(
  supabase: NotificationClient,
  notificationType: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  siteUrl: string
): Promise<{ emailSubject: string; emailBody: string }> {
  let emailSubject = title;
  let emailBody = "";
  const malformed = isBranchDataMalformed(notificationType, data);

  if (!malformed && notificationType === "message" && typeof data.sender_id === "string" && data.sender_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    const isSharedItem = body && body.startsWith("Shared: ");
    const threadUrl = `${siteUrl}/notifications?tab=messages&thread=${data.sender_id}`;
    if (isSharedItem) {
      const itemTitle = body.replace("Shared: ", "");
      emailSubject = `${senderName} shared something with you`;
      emailBody = `
        <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${escapeHtml(senderName)} shared "${escapeHtml(itemTitle)}" with you!</h2>
        <a href="${threadUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View</a>
      `;
    } else {
      emailSubject = `New message from ${senderName} on Inlight`;
      emailBody = `
        <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">You got a new message from ${escapeHtml(senderName)} on Inlight!</h2>
        ${body ? `<p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">"${escapeHtml(body)}"</p>` : ""}
        <a href="${threadUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View</a>
      `;
    }
  } else if (!malformed && notificationType === "application" && typeof data.applicant_id === "string" && data.applicant_id && typeof data.project_id === "string" && data.project_id) {
    const applicantName = await getDisplayName(supabase, data.applicant_id);
    let roleName = "a role";
    let projectTitle = "your project";

    if (typeof data.role_id === "string" && data.role_id) {
      const { data: roleData } = await supabase
        .from("project_roles")
        .select("role_name, projects(title)")
        .eq("id", data.role_id)
        .single();
      if (roleData) {
        roleName = roleData.role_name || roleName;
        projectTitle = getJoinedProjectTitle(roleData.projects) || projectTitle;
      }
    }

    const reviewUrl = `${siteUrl}/projects/${data.project_id}?application=${data.application_id}`;
    emailSubject = `${applicantName} applied for ${roleName}`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${escapeHtml(applicantName)} applied for ${escapeHtml(roleName)} in ${escapeHtml(projectTitle)}!</h2>
      <a href="${reviewUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Review</a>
    `;
  } else if (!malformed && notificationType === "connection_request" && typeof data.sender_id === "string" && data.sender_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    emailSubject = `${senderName} wants to connect with you!`;
    const profileUrl = `${siteUrl}/profile/${data.sender_id}`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${escapeHtml(senderName)} wants to connect with you!</h2>
      <a href="${profileUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Respond</a>
    `;
  } else if (!malformed && notificationType === "invitation" && typeof data.sender_id === "string" && data.sender_id) {
    let roleName = typeof data.role_name === "string" ? data.role_name || "a role" : "a role";
    let projectTitle = typeof data.project_title === "string" ? data.project_title || "a project" : "a project";
    let projectId = typeof data.project_id === "string" ? data.project_id || "" : "";

    if (typeof data.role_id === "string" && data.role_id) {
      const { data: roleData } = await supabase
        .from("project_roles")
        .select("role_name, project_id, projects(title)")
        .eq("id", data.role_id)
        .single();
      if (roleData) {
        roleName = roleData.role_name || roleName;
        projectTitle = getJoinedProjectTitle(roleData.projects) || projectTitle;
        projectId = roleData.project_id || "";
      }
    }

    const creatorName = await getProjectCreatorDisplayName(supabase, projectId, data.sender_id);
    const projectUrl = projectId
      ? `${siteUrl}/projects/${projectId}`
      : `${siteUrl}/notifications`;

    emailSubject = `${creatorName} invited you to join ${projectTitle}!`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">You've been invited!</h2>
      <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${escapeHtml(creatorName)} has invited you to join <strong>${escapeHtml(projectTitle)}</strong> as <strong>${escapeHtml(roleName)}</strong>.</p>
      <a href="${projectUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View Invitation</a>
    `;
  } else if (!malformed && notificationType === "application_accepted" && typeof data.sender_id === "string" && data.sender_id && typeof data.project_id === "string" && data.project_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    const roleName = typeof data.role_name === "string" ? data.role_name || "a role" : "a role";
    const projectTitle = typeof data.project_title === "string" ? data.project_title || "a project" : "a project";
    const projectUrl = `${siteUrl}/projects/${data.project_id}`;

    emailSubject = `CONGRATULATIONS! You've just been hired!`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:700;">🎉 CONGRATULATIONS!</h2>
      <h3 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">You've just been hired!</h3>
      <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${escapeHtml(senderName)} has offered you the role of <strong>${escapeHtml(roleName)}</strong> on <strong>${escapeHtml(projectTitle)}</strong>.</p>
      <a href="${projectUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Respond</a>
    `;
  } else if (!malformed && notificationType === "job_match" && typeof data.opportunity_id === "string" && data.opportunity_id) {
    const opportunityTitle = typeof data.opportunity_title === "string" ? data.opportunity_title || "a new opportunity" : "a new opportunity";
    const matchedRoles = Array.isArray(data.matched_roles) ? data.matched_roles : [];
    const matchText = matchedRoles.length > 0
      ? `matching your skills: <strong>${matchedRoles.join(", ")}</strong>`
      : "matching your skillset";
    const jobUrl = `${siteUrl}/opportunities`;

    emailSubject = `New opportunity matching your skills: ${opportunityTitle}`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">New opportunity for you!</h2>
      <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">A new job has been posted — <strong>${escapeHtml(opportunityTitle)}</strong> — ${escapeHtml(matchText)}.</p>
      <a href="${jobUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View Opportunity</a>
    `;
  } else {
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${escapeHtml(title)}</h2>
      ${body ? `<p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${escapeHtml(body)}</p>` : ""}
      <a href="${siteUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View on Inlight</a>
    `;
  }

  return { emailSubject, emailBody };
}

async function getDisplayName(supabase: NotificationClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.display_name) return data.display_name;
  if (data?.email) return data.email.split("@")[0];

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const metadata = authUser?.user?.user_metadata || {};
  const metadataName =
    metadata.display_name ||
    metadata.full_name ||
    [metadata.first_name, metadata.last_name].filter(Boolean).join(" ");
  if (metadataName) return String(metadataName);

  const email = authUser?.user?.email || "";
  return email ? email.split("@")[0] : "Someone";
}

async function getProjectCreatorDisplayName(
  supabase: NotificationClient,
  projectId: string,
  fallbackUserId: string
): Promise<string> {
  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("creator_id")
      .eq("id", projectId)
      .maybeSingle();

    if (project?.creator_id) {
      return getDisplayName(supabase, project.creator_id);
    }
  }

  return getDisplayName(supabase, fallbackUserId);
}

function wrapEmailTemplate(emailBody: string): string {
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
}
