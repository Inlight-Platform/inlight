import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      .single();

    if (profileError || !profile) {
      console.error("[send-notification-email] Profile not found:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-notification-email] Recipient:", profile.email, "| email_notifications:", profile.email_notifications);

    if (profile.email_notifications === false) {
      console.log("[send-notification-email] Email notifications disabled for user");
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationType = record.type || "notification";
    const title = record.title || "New Notification";
    const body = record.body || "";
    const data = record.data || {};

    console.log("[send-notification-email] Notification type:", notificationType, "| title:", title);

    const { emailSubject, emailBody } = await buildEmailContent(
      supabase, notificationType, title, body, data
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

    console.log("[send-notification-email] Sending email to:", profile.email, "| subject:", emailSubject);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Inlight <notifications@inlight.social>",
      to: [profile.email],
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

async function buildEmailContent(
  supabase: any,
  notificationType: string,
  title: string,
  body: string,
  data: any
): Promise<{ emailSubject: string; emailBody: string }> {
  let emailSubject = title;
  let emailBody = "";

  if (notificationType === "message" && data.sender_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    const isSharedItem = body && body.startsWith("Shared: ");
    const threadUrl = `https://inlight.lovable.app/notifications?tab=messages&thread=${data.sender_id}`;
    if (isSharedItem) {
      const itemTitle = body.replace("Shared: ", "");
      emailSubject = `${senderName} shared something with you`;
      emailBody = `
        <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${senderName} shared "${itemTitle}" with you!</h2>
        <a href="${threadUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View</a>
      `;
    } else {
      emailSubject = `New message from ${senderName} on Inlight`;
      emailBody = `
        <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">You got a new message from ${senderName} on Inlight!</h2>
        ${body ? `<p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">"${body}"</p>` : ""}
        <a href="${threadUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View</a>
      `;
    }
  } else if (notificationType === "application" && data.applicant_id && data.project_id) {
    const applicantName = await getDisplayName(supabase, data.applicant_id);
    let roleName = "a role";
    let projectTitle = "your project";

    if (data.role_id) {
      const { data: roleData } = await supabase
        .from("project_roles")
        .select("role_name, projects(title)")
        .eq("id", data.role_id)
        .single();
      if (roleData) {
        roleName = roleData.role_name || roleName;
        projectTitle = (roleData.projects as any)?.title || projectTitle;
      }
    }

    const reviewUrl = `https://inlight.lovable.app/projects/${data.project_id}?application=${data.application_id}`;
    emailSubject = `${applicantName} applied for ${roleName}`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${applicantName} applied for ${roleName} in ${projectTitle}!</h2>
      <a href="${reviewUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Review</a>
    `;
  } else if (notificationType === "connection_request" && data.sender_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    emailSubject = `${senderName} wants to connect with you!`;
    const profileUrl = `https://inlight.lovable.app/profile/${data.sender_id}`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${senderName} wants to connect with you!</h2>
      <a href="${profileUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Respond</a>
    `;
  } else if (notificationType === "invitation" && data.sender_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    let roleName = "a role";
    let projectTitle = "a project";
    let projectId = "";

    if (data.role_id) {
      const { data: roleData } = await supabase
        .from("project_roles")
        .select("role_name, project_id, projects(title)")
        .eq("id", data.role_id)
        .single();
      if (roleData) {
        roleName = roleData.role_name || roleName;
        projectTitle = (roleData.projects as any)?.title || projectTitle;
        projectId = roleData.project_id || "";
      }
    }

    const projectUrl = projectId
      ? `https://inlight.lovable.app/projects/${projectId}`
      : "https://inlight.lovable.app/notifications";

    emailSubject = `${senderName} invited you to join ${projectTitle}!`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">You've been invited!</h2>
      <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${senderName} has invited you to join <strong>${projectTitle}</strong> as <strong>${roleName}</strong>.</p>
      <a href="${projectUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View Invitation</a>
    `;
  } else if (notificationType === "application_accepted" && data.sender_id && data.project_id) {
    const senderName = await getDisplayName(supabase, data.sender_id);
    const roleName = data.role_name || "a role";
    const projectTitle = data.project_title || "a project";
    const projectUrl = `https://inlight.lovable.app/projects/${data.project_id}`;

    emailSubject = `CONGRATULATIONS! You've just been hired!`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:22px;font-weight:700;">🎉 CONGRATULATIONS!</h2>
      <h3 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">You've just been hired!</h3>
      <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${senderName} has offered you the role of <strong>${roleName}</strong> on <strong>${projectTitle}</strong>.</p>
      <a href="${projectUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Respond</a>
    `;
  } else if (notificationType === "job_match" && data.opportunity_id) {
    const opportunityTitle = data.opportunity_title || "a new opportunity";
    const matchedRoles = data.matched_roles || [];
    const matchText = matchedRoles.length > 0
      ? `matching your skills: <strong>${matchedRoles.join(", ")}</strong>`
      : "matching your skillset";
    const jobUrl = `https://inlight.lovable.app/opportunities`;

    emailSubject = `New opportunity matching your skills: ${opportunityTitle}`;
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">New opportunity for you!</h2>
      <p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">A new job has been posted — <strong>${opportunityTitle}</strong> — ${matchText}.</p>
      <a href="${jobUrl}" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View Opportunity</a>
    `;
  } else {
    emailBody = `
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:18px;font-weight:600;">${title}</h2>
      ${body ? `<p style="margin:0 0 24px;color:#4a4a68;font-size:14px;line-height:1.6;">${body}</p>` : ""}
      <a href="https://inlight.lovable.app" style="display:inline-block;background-color:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">View on Inlight</a>
    `;
  }

  return { emailSubject, emailBody };
}

async function getDisplayName(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .single();
  return data?.display_name || "Someone";
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
