import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Building2, Loader2, ExternalLink, CheckCircle2, XCircle, Copy, RefreshCw, UserPlus, Mail, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface RequestRow {
  id: string;
  requester_id: string;
  company_name: string;
  description: string | null;
  website_url: string | null;
  justification: string;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string | null;
  created_company_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null };
}

interface StaffInviteLink {
  email: string;
  staffName: string | null;
  token: string;
  editUrl: string;
}

interface StaffDraft {
  id: string;
  name: string;
  email: string;
}

interface CompanyTrackerRow {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  created_at: string;
}

interface StaffAccessRow {
  id: string;
  company_id: string;
  email: string;
  staff_name: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  const context = (error as any)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.clone().json();
      const detailMessage = body?.details?.message || body?.details?.error || body?.details?.name;
      if (body?.error && detailMessage) {
        return `${body.error}: ${detailMessage}`;
      }
      return body?.error || body?.message || detailMessage || fallback;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        // Fall through to the normal Supabase error message.
      }
    }
  }
  return (error as any)?.message || fallback;
};

const CompanyRequestsManager: React.FC = () => {
  const qc = useQueryClient();
  const [actionReq, setActionReq] = useState<RequestRow | null>(null);
  const [action, setAction] = useState<'approve' | 'deny' | null>(null);
  const [notes, setNotes] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [staffDrafts, setStaffDrafts] = useState<StaffDraft[]>([{ id: crypto.randomUUID(), name: '', email: '' }]);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [createdCompanyName, setCreatedCompanyName] = useState('');
  const [createdInviteLinks, setCreatedInviteLinks] = useState<StaffInviteLink[]>([]);
  const [staffEmailByCompany, setStaffEmailByCompany] = useState<Record<string, string>>({});
  const [staffNameByCompany, setStaffNameByCompany] = useState<Record<string, string>>({});
  const [freshInviteByAccessKey, setFreshInviteByAccessKey] = useState<Record<string, StaffInviteLink>>({});
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-company-requests'],
    queryFn: async () => {
      const { data: reqs, error } = await supabase
        .from('company_account_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const userIds = Array.from(new Set((reqs || []).map((r: any) => r.requester_id)));
      let profileMap = new Map<string, any>();
      if (userIds.length) {
        const { data: profiles, error: profilesError } = await (supabase.rpc as any)(
          'get_company_requester_profiles',
          { _user_ids: userIds }
        );
        if (profilesError) throw profilesError;
        profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      }
      return (reqs || []).map((r: any) => ({ ...r, profile: profileMap.get(r.requester_id) })) as RequestRow[];
    },
  });

  const { data: trackedCompanies = [], isLoading: trackedCompaniesLoading } = useQuery({
    queryKey: ['admin-tracked-companies'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('companies')
        .select('id, name, description, website_url, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (rows || []) as CompanyTrackerRow[];
    },
  });

  const { data: staffAccessRows = [], isLoading: staffAccessLoading } = useQuery({
    queryKey: ['admin-company-staff-access'],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from('company_staff_access')
        .select('id, company_id, email, staff_name, created_at, last_used_at, expires_at, revoked_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (rows || []) as StaffAccessRow[];
    },
  });

  const approveMut = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: string; adminNotes: string }) => {
      const { data, error } = await supabase.functions.invoke('approve-company-account', {
        body: { request_id: id, admin_notes: adminNotes || null },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Failed to approve company account'));
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (result: any) => {
      if (result?.approval_email_sent === false) {
        toast.warning('Company account created, but the approval email was not sent');
      } else {
        toast.success('Company account created and approval email sent');
      }
      qc.invalidateQueries({ queryKey: ['admin-company-requests'] });
      reset();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to approve'),
  });

  const denyMut = useMutation({
    mutationFn: async ({ id }: { id: string; adminNotes: string }) => {
      const { error } = await supabase.rpc('deny_company_account_request', {
        _request_id: id,
        _admin_notes: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request removed');
      qc.invalidateQueries({ queryKey: ['admin-company-requests'] });
      reset();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to deny'),
  });

  const createCompanyMut = useMutation({
    mutationFn: async () => {
      const staffMembers = staffDrafts
        .map((staff) => ({
          name: staff.name.trim(),
          email: staff.email.trim().toLowerCase(),
        }))
        .filter((staff) => staff.email);

      const { data, error } = await (supabase.rpc as any)('admin_create_company_page', {
        _name: companyName.trim(),
        _description: companyDescription.trim() || null,
        _website_url: companyWebsite.trim() || null,
        _staff_members: staffMembers,
      });

      if (error) throw error;

      const result = data as { company_id: string; invites?: Array<{ email: string; staff_name?: string | null; token: string }> };
      return {
        companyId: result.company_id,
        companyName: companyName.trim(),
        inviteLinks: (result.invites || []).map((invite) => ({
          email: invite.email,
          staffName: invite.staff_name || null,
          token: invite.token,
          editUrl: `${window.location.origin}/company-edit/${invite.token}`,
        })),
      };
    },
    onSuccess: ({ companyId, companyName: createdName, inviteLinks }) => {
      toast.success('Company page created');
      setCreatedCompanyId(companyId);
      setCreatedCompanyName(createdName);
      setCreatedInviteLinks(inviteLinks);
      setCompanyName('');
      setCompanyDescription('');
      setCompanyWebsite('');
      setStaffDrafts([{ id: crypto.randomUUID(), name: '', email: '' }]);
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['admin-tracked-companies'] });
      qc.invalidateQueries({ queryKey: ['admin-company-staff-access'] });
      qc.invalidateQueries({ queryKey: ['admin-company-requests'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create company page'),
  });

  const createStaffAccessMut = useMutation({
    mutationFn: async ({ companyId, email, staffName }: { companyId: string; email: string; staffName?: string }) => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = staffName?.trim() || '';
      if (!cleanEmail) throw new Error('Staff email is required');

      const { data, error } = await (supabase.rpc as any)('add_company_staff_access', {
        _company_id: companyId,
        _email: cleanEmail,
        _staff_name: cleanName || null,
        _expires_at: null,
      });
      if (error) throw error;

      const row = (data || [])[0] as { access_id: string; access_company_id: string; access_email: string; access_staff_name?: string | null; token: string } | undefined;
      if (!row?.token) throw new Error('No edit token returned');

      return {
        accessKey: `${companyId}:${cleanEmail}`,
        companyId,
        invite: {
          email: row.access_email,
          staffName: row.access_staff_name || null,
          token: row.token,
          editUrl: `${window.location.origin}/company-edit/${row.token}`,
        },
      };
    },
    onSuccess: ({ accessKey, companyId, invite }) => {
      toast.success('Staff edit link generated');
      setFreshInviteByAccessKey((current) => ({ ...current, [accessKey]: invite }));
      setStaffEmailByCompany((current) => ({ ...current, [companyId]: '' }));
      setStaffNameByCompany((current) => ({ ...current, [companyId]: '' }));
      qc.invalidateQueries({ queryKey: ['admin-company-staff-access'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to generate staff link'),
  });

  const sendStaffLinkEmailMut = useMutation({
    mutationFn: async ({ invite, companyName }: { invite: StaffInviteLink; companyName: string }) => {
      const { data, error } = await supabase.functions.invoke('send-company-staff-link', {
        body: {
          email: invite.email,
          staffName: invite.staffName || null,
          companyName,
          editUrl: invite.editUrl,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Failed to send staff edit link email'));
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => toast.success('Staff edit link emailed'),
    onError: (e: any) => toast.error(e?.message || 'Failed to send email'),
  });

  const deleteCompanyMut = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Company page deleted');
      setDeletingCompanyId(null);
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['admin-tracked-companies'] });
      qc.invalidateQueries({ queryKey: ['admin-company-staff-access'] });
      qc.invalidateQueries({ queryKey: ['admin-company-requests'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete company page'),
  });

  const reset = () => {
    setActionReq(null);
    setAction(null);
    setNotes('');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = data?.filter((r) => r.status === 'pending') || [];
  const reviewed = data?.filter((r) => r.status !== 'pending') || [];
  const staffByCompany = staffAccessRows.reduce<Record<string, StaffAccessRow[]>>((acc, row) => {
    acc[row.company_id] = acc[row.company_id] || [];
    acc[row.company_id].push(row);
    return acc;
  }, {});

  const copyText = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const renderRow = (r: RequestRow) => (
    <Card key={r.id} className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {r.company_name}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Requested by{' '}
              <span className="font-medium text-foreground">
                {r.profile?.display_name || r.profile?.email || 'Unknown'}
              </span>{' '}
              · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </p>
          </div>
          <Badge
            variant={
              r.status === 'approved' ? 'default' : r.status === 'denied' ? 'destructive' : 'secondary'
            }
          >
            {r.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {r.description && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Description</div>
            <p>{r.description}</p>
          </div>
        )}
        {r.website_url && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Website</div>
            <a
              href={r.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {r.website_url} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Justification</div>
          <p className="whitespace-pre-wrap">{r.justification}</p>
        </div>
        {r.admin_notes && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Admin notes</div>
            <p className="text-muted-foreground">{r.admin_notes}</p>
          </div>
        )}

        {r.status === 'pending' && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              onClick={() => {
                setActionReq(r);
                setAction('approve');
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setActionReq(r);
                setAction('deny');
              }}
            >
              <XCircle className="h-4 w-4 mr-1" /> Deny
            </Button>
          </div>
        )}

        {r.status === 'approved' && r.created_company_id && (
          <Button asChild size="sm" variant="outline">
            <a href={`/company/${r.created_company_id}`} target="_blank" rel="noreferrer">
              View company <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Create company page
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-company-name">Company name</Label>
              <Input
                id="admin-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company or organization name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-company-website">Website</Label>
              <Input
                id="admin-company-website"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-company-description">Short description</Label>
            <Textarea
              id="admin-company-description"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              rows={2}
              placeholder="A quick public description for the page"
            />
          </div>
          <div className="space-y-2">
            <Label>Staff members</Label>
            <div className="space-y-2">
              {staffDrafts.map((staff) => (
                <div key={staff.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    value={staff.name}
                    onChange={(e) => setStaffDrafts((current) => current.map((item) => (
                      item.id === staff.id ? { ...item, name: e.target.value } : item
                    )))}
                    placeholder="Staff name"
                  />
                  <Input
                    value={staff.email}
                    onChange={(e) => setStaffDrafts((current) => current.map((item) => (
                      item.id === staff.id ? { ...item, email: e.target.value } : item
                    )))}
                    placeholder="staff@company.com"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={staffDrafts.length === 1}
                    onClick={() => setStaffDrafts((current) => current.filter((item) => item.id !== staff.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setStaffDrafts((current) => [...current, { id: crypto.randomUUID(), name: '', email: '' }])}
            >
              <Plus className="h-4 w-4" />
              Add staff member
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={createCompanyMut.isPending || !companyName.trim()}
              onClick={() => createCompanyMut.mutate()}
            >
              {createCompanyMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create page
            </Button>
            {createdCompanyId && (
              <Button asChild variant="outline">
                <a href={`/company/${createdCompanyId}`} target="_blank" rel="noreferrer">
                  Open admin page <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </div>

          {createdInviteLinks.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Staff edit links</div>
              {createdInviteLinks.map((invite) => (
                <div key={invite.token} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                  <span className="font-medium min-w-0 sm:w-48 truncate">{invite.staffName || invite.email}</span>
                  <code className="flex-1 rounded bg-background px-2 py-1 text-xs break-all">{invite.editUrl}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => copyText(invite.editUrl, 'Edit link copied')}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={sendStaffLinkEmailMut.isPending}
                    onClick={() => sendStaffLinkEmailMut.mutate({ invite, companyName: createdCompanyName || 'Company page' })}
                  >
                    {sendStaffLinkEmailMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                    Email
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tracked company pages ({trackedCompanies.length})
          </h3>
          {(trackedCompaniesLoading || staffAccessLoading) && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {trackedCompanies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No company pages yet.</p>
        ) : (
          <div className="space-y-3">
            {trackedCompanies.map((company) => {
              const staffRows = staffByCompany[company.id] || [];
              const publicUrl = `${window.location.origin}/c/${company.id}`;
              const adminUrl = `${window.location.origin}/company/${company.id}`;
              const draftStaffEmail = staffEmailByCompany[company.id] || '';
              const draftStaffName = staffNameByCompany[company.id] || '';

              return (
                <Card key={company.id} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="truncate">{company.name}</span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDistanceToNow(new Date(company.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="secondary">{staffRows.filter((row) => !row.revoked_at).length} staff</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/company/${company.id}`} target="_blank" rel="noreferrer">
                          Admin page <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/c/${company.id}`} target="_blank" rel="noreferrer">
                          Public page <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyText(publicUrl, 'Public link copied')}>
                        <Copy className="h-3 w-3" />
                        Copy public link
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyText(adminUrl, 'Admin link copied')}>
                        <Copy className="h-3 w-3" />
                        Copy admin link
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            disabled={deleteCompanyMut.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the company page, staff edit links, follows, and company photos. Linked projects will remain but will no longer be attached to this company.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleteCompanyMut.isPending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deleteCompanyMut.isPending}
                              onClick={(e) => {
                                e.preventDefault();
                                setDeletingCompanyId(company.id);
                                deleteCompanyMut.mutate(company.id);
                              }}
                            >
                              {deleteCompanyMut.isPending && deletingCompanyId === company.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : null}
                              Delete company
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Staff edit access</div>
                      </div>

                      {staffRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No staff emails have been added for this page.</p>
                      ) : (
                        <div className="space-y-2">
                          {staffRows.map((staff) => {
                            const accessKey = `${company.id}:${staff.email}`;
                            const freshInvite = freshInviteByAccessKey[accessKey];
                            return (
                              <div key={staff.id} className="rounded-md bg-muted/30 p-2 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{staff.staff_name || staff.email}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {staff.staff_name ? `${staff.email} · ` : ''}
                                      Added {formatDistanceToNow(new Date(staff.created_at), { addSuffix: true })}
                                      {staff.last_used_at ? ` · used ${formatDistanceToNow(new Date(staff.last_used_at), { addSuffix: true })}` : ''}
                                      {staff.revoked_at ? ' · revoked' : ''}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    disabled={createStaffAccessMut.isPending}
                                    onClick={() => createStaffAccessMut.mutate({ companyId: company.id, email: staff.email, staffName: staff.staff_name || undefined })}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    New edit link
                                  </Button>
                                </div>
                                {freshInvite && (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                    <code className="flex-1 rounded bg-background px-2 py-1 text-xs break-all">{freshInvite.editUrl}</code>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="gap-1"
                                      onClick={() => copyText(freshInvite.editUrl, 'Edit link copied')}
                                    >
                                      <Copy className="h-3 w-3" />
                                      Copy
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="gap-1"
                                      disabled={sendStaffLinkEmailMut.isPending}
                                      onClick={() => sendStaffLinkEmailMut.mutate({ invite: freshInvite, companyName: company.name })}
                                    >
                                      {sendStaffLinkEmailMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                                      Email
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-2 border-t border-border">
                        <Input
                          value={draftStaffName}
                          onChange={(e) => setStaffNameByCompany((current) => ({ ...current, [company.id]: e.target.value }))}
                          placeholder="Staff name"
                        />
                        <Input
                          value={draftStaffEmail}
                          onChange={(e) => setStaffEmailByCompany((current) => ({ ...current, [company.id]: e.target.value }))}
                          placeholder="staff@company.com"
                        />
                        <Button
                          className="gap-1"
                          disabled={createStaffAccessMut.isPending || !draftStaffEmail.trim()}
                          onClick={() => createStaffAccessMut.mutate({ companyId: company.id, email: draftStaffEmail, staffName: draftStaffName })}
                        >
                          {createStaffAccessMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          Add staff link
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="space-y-3">{pending.map(renderRow)}</div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reviewed ({reviewed.length})
        </h3>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewed requests yet.</p>
        ) : (
          <div className="space-y-3">{reviewed.map(renderRow)}</div>
        )}
      </section>

      <Dialog open={!!actionReq && !!action} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve' : 'Deny'} request for {actionReq?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {action === 'approve'
                ? `This creates a company named "${actionReq?.company_name}" with ${
                    actionReq?.profile?.display_name || 'the requester'
                  } as the owner.`
                : 'Optionally add a note explaining why.'}
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Notes (optional)"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button
              variant={action === 'deny' ? 'destructive' : 'default'}
              disabled={approveMut.isPending || denyMut.isPending}
              onClick={() => {
                if (!actionReq) return;
                if (action === 'approve') {
                  approveMut.mutate({ id: actionReq.id, adminNotes: notes });
                } else {
                  denyMut.mutate({ id: actionReq.id, adminNotes: notes });
                }
              }}
            >
              {(approveMut.isPending || denyMut.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm {action === 'approve' ? 'Approve' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyRequestsManager;
