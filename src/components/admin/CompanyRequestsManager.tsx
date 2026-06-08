import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
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

const CompanyRequestsManager: React.FC = () => {
  const qc = useQueryClient();
  const [actionReq, setActionReq] = useState<RequestRow | null>(null);
  const [action, setAction] = useState<'approve' | 'deny' | null>(null);
  const [notes, setNotes] = useState('');

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
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, avatar_url')
          .in('user_id', userIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      }
      return (reqs || []).map((r: any) => ({ ...r, profile: profileMap.get(r.requester_id) })) as RequestRow[];
    },
  });

  const approveMut = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: string; adminNotes: string }) => {
      const { data, error } = await supabase.rpc('approve_company_account_request', {
        _request_id: id,
        _admin_notes: adminNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Company account created');
      qc.invalidateQueries({ queryKey: ['admin-company-requests'] });
      reset();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to approve'),
  });

  const denyMut = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: string; adminNotes: string }) => {
      const { error } = await supabase.rpc('deny_company_account_request', {
        _request_id: id,
        _admin_notes: adminNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request denied');
      qc.invalidateQueries({ queryKey: ['admin-company-requests'] });
      reset();
    },
    onError: (e: any) => toast.error(e.message || 'Failed to deny'),
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