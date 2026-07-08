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

async function sendCompanyDenialEmail({
  email,
  companyName,
  adminNotes,
}: {
  email: string;
  companyName: string;
  adminNotes: string | null;
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { sent: false, error: 'Missing RESEND_API_KEY' };
  }

  const requestUrl = `${getSiteUrl()}/profile`;
  const noteHtml = adminNotes
    ? `<div style="background:#f7f4ee;border:1px solid #e6dccb;border-radius:10px;padding:14px;margin:18px 0;">
        <p style="margin:0 0 6px;"><strong>Admin note</strong></p>
        <p style="margin:0;">${escapeHtml(adminNotes)}</p>
      </div>`
    : '';

  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: 'Inlight <notifications@inlight.social>',
    to: [email],
    subject: `${companyName} company account request update`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#171717;max-width:600px;margin:0 auto;padding:32px 20px;">
        <h1 style="font-size:26px;line-height:1.2;margin:0 0 12px;">Company account request update</h1>
        <p style="margin:0 0 16px;">Your request for <strong>${escapeHtml(companyName)}</strong> was not approved at this time.</p>
        ${noteHtml}
        <p style="margin:0 0 16px;">You can review your request history from your profile. If the note asks for more information or a different company login email, submit a new request with those changes.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(requestUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;">Open your profile</a>
        </p>
      </div>
    `,
  });

  if (error) {
    const message = typeof error === 'object' && error ? JSON.stringify(error) : String(error);
    return { sent: false, error: message };
  }

  return { sent: true, error: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin, error: adminErr } = await userClient.rpc('has_role', {
      _user_id: userRes.user.id,
      _role: 'admin',
    });
    if (adminErr) {
      return new Response(JSON.stringify({ error: adminErr.message || 'Failed to verify admin role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { request_id, admin_notes } = await req.json();
    const adminNotes = typeof admin_notes === 'string' ? admin_notes.trim() || null : null;
    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: reqRow, error: reqErr } = await admin
      .from('company_account_requests')
      .select('*')
      .eq('id', request_id)
      .maybeSingle();
    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (reqRow.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Request already ${reqRow.status}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateErr } = await admin
      .from('company_account_requests')
      .update({
        status: 'denied',
        reviewed_by: userRes.user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes,
        company_password: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request_id)
      .eq('status', 'pending');
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message || 'Failed to deny request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: requester } = await admin.auth.admin.getUserById(reqRow.requester_id);
    const requesterEmail = requester?.user?.email || null;
    const denialEmail = requesterEmail
      ? await sendCompanyDenialEmail({
          email: requesterEmail,
          companyName: reqRow.company_name,
          adminNotes,
        })
      : { sent: false, error: 'Requester email not found' };

    return new Response(
      JSON.stringify({
        request_id,
        denied: true,
        denial_email_sent: denialEmail.sent,
        denial_email_error: denialEmail.error,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
