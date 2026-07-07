import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_SITE_URL = 'https://inlight.social';

function getSiteUrl() {
  return (Deno.env.get('SITE_URL') || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendCompanyApprovalEmail({
  email,
  companyName,
  companyId,
}: {
  email: string;
  companyName: string;
  companyId: string;
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { sent: false, error: 'Missing RESEND_API_KEY' };
  }

  const siteUrl = getSiteUrl();
  const signInUrl = `${siteUrl}/auth`;
  const companyManageUrl = `${siteUrl}/company/${companyId}`;
  const publicCompanyUrl = `${siteUrl}/c/${companyId}`;
  const resend = new Resend(resendApiKey);

  const { error } = await resend.emails.send({
    from: 'Inlight <notifications@inlight.social>',
    to: [email],
    subject: `${companyName} is approved on Inlight`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;padding:32px 20px;">
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Your company account is ready</h1>
        <p style="margin:0 0 16px;">The company account for <strong>${escapeHtml(companyName)}</strong> has been approved.</p>
        <div style="background:#f7f4ee;border:1px solid #e6dccb;border-radius:10px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;"><strong>How to access it</strong></p>
          <ol style="margin:0;padding-left:20px;">
            <li>Sign in with this email: <strong>${escapeHtml(email)}</strong></li>
            <li>Use the password you entered when requesting the company account.</li>
            <li>Open your company page to manage details, media, and projects.</li>
          </ol>
        </div>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(signInUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Sign in to Inlight</a>
        </p>
        <p style="margin:0 0 12px;">After signing in, manage the page here:<br>
          <a href="${escapeHtml(companyManageUrl)}">${escapeHtml(companyManageUrl)}</a>
        </p>
        <p style="margin:0 0 12px;">Public company page:<br>
          <a href="${escapeHtml(publicCompanyUrl)}">${escapeHtml(publicCompanyUrl)}</a>
        </p>
        <p style="font-size:13px;color:#666;margin:24px 0 0;">Staff edit links are for delegated page edits. This company account is the long-term ownership login for managing the company on Inlight.</p>
      </div>
    `,
  });

  if (error) {
    const message = typeof error === 'object' && error
      ? JSON.stringify(error)
      : String(error);
    return { sent: false, error: message };
  }

  return { sent: true, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin, error: adminErr } = await userClient.rpc('has_role', {
      _user_id: userRes.user.id,
      _role: 'admin',
    });
    if (adminErr) {
      return new Response(JSON.stringify({ error: adminErr.message || 'Failed to verify admin role' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { request_id, admin_notes } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: reqRow, error: reqErr } = await admin
      .from('company_account_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();
    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Request already ${reqRow.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!reqRow.company_email || !reqRow.company_password) {
      return new Response(JSON.stringify({ error: 'Request missing company email/password' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyEmail = String(reqRow.company_email).trim().toLowerCase();
    let newOwnerId: string | null = null;
    let createdOwnerInThisRequest = false;

    const { error: inviteErr } = await userClient.rpc('create_platform_invite', {
      _email: companyEmail,
      _note: `Company account approval for ${reqRow.company_name}`,
    });
    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message || 'Failed to prepare company signup invite' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: companyEmail,
      password: reqRow.company_password,
      email_confirm: true,
      user_metadata: { display_name: reqRow.company_name, is_company: true },
    });
    if (createErr || !created.user) {
      const isDuplicateEmail = /already been registered|already registered|already exists/i.test(createErr?.message || '');
      if (isDuplicateEmail) {
        const duplicateEmailNote =
          `Action needed: ${companyEmail} is already registered on Inlight. ` +
          'Please edit this pending company request and enter a different company login email that is not already used by an Inlight account. ' +
          'After you update the request, an admin can approve it.';

        await admin
          .from('company_account_requests')
          .update({
            admin_notes: duplicateEmailNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', request_id)
          .eq('status', 'pending');

        return new Response(
          JSON.stringify({
            error:
              'That company login email is already registered. The pending request now includes next steps for the requester.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    if (!newOwnerId && (createErr || !created.user)) {
      return new Response(JSON.stringify({ error: createErr?.message || 'Failed to create account' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!newOwnerId) {
      newOwnerId = created.user.id;
      createdOwnerInThisRequest = true;
    }

    await admin.auth.admin.updateUserById(newOwnerId, {
      user_metadata: { display_name: reqRow.company_name, is_company: true },
    });

    // Best-effort profile sync. Company approval should not fail if profile grants drift.
    await admin
      .from('profiles')
      .upsert({
        user_id: newOwnerId,
        email: companyEmail,
        display_name: reqRow.company_name,
        headline: reqRow.description || null,
        website_url: reqRow.website_url || null,
      }, { onConflict: 'user_id' });

    // Create company row + finalize request
    const { data: newCompanyId, error: finErr } = await admin.rpc(
      'finalize_company_account_approval',
      {
        _request_id: request_id,
        _new_owner_id: newOwnerId,
        _admin_notes: admin_notes || null,
      },
    );
    if (finErr) {
      if (createdOwnerInThisRequest) {
        await admin.auth.admin.deleteUser(newOwnerId);
      }

      return new Response(JSON.stringify({ error: finErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const approvalEmail = await sendCompanyApprovalEmail({
      email: companyEmail,
      companyName: reqRow.company_name,
      companyId: newCompanyId,
    });

    return new Response(
      JSON.stringify({
        company_id: newCompanyId,
        owner_user_id: newOwnerId,
        approval_email_sent: approvalEmail.sent,
        approval_email_error: approvalEmail.error,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
