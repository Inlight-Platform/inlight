import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AffiliationRequest {
  id: string;
  user_id: string;
  requested_name: string;
  description_or_context: string | null;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  approved: 'bg-green-500/10 text-green-700 border-green-300',
  denied: 'bg-red-500/10 text-red-700 border-red-300',
};

const AffiliationRequestsManager: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewingRequest, setReviewingRequest] = useState<AffiliationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [badgeTag, setBadgeTag] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'deny' | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['affiliation-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliation_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (!data?.length) return [];

      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
      return data.map((r) => ({ ...r, profile: profileMap[r.user_id] ?? null })) as AffiliationRequest[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      notes,
      tag,
      name,
      userId,
    }: {
      id: string;
      action: 'approve' | 'deny';
      notes: string;
      tag: string;
      name: string;
      userId: string;
    }) => {
      if (action === 'approve') {
        if (!tag.trim()) throw new Error('Badge tag is required to approve');
        const normalizedTag = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 25);
        if (!normalizedTag) throw new Error('Invalid badge tag');

        const { error: studioError } = await supabase
          .from('studios')
          .insert({ name, badge_tag: normalizedTag });
        if (studioError && !studioError.message.includes('duplicate')) throw studioError;
      }

      const { error } = await supabase
        .from('affiliation_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'denied',
          admin_notes: notes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      await (supabase.rpc as any)('notify_affiliation_reviewed', {
        p_user_id: userId,
        p_action: action === 'approve' ? 'approved' : 'denied',
        p_name: name,
        p_notes: notes || null,
      });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['affiliation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['studios'] });
      toast.success(action === 'approve' ? 'Affiliation approved and added' : 'Request denied');
      setReviewingRequest(null);
      setAdminNotes('');
      setBadgeTag('');
      setReviewAction(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to process request');
    },
  });

  const openReview = (request: AffiliationRequest, action: 'approve' | 'deny') => {
    setReviewingRequest(request);
    setReviewAction(action);
    setAdminNotes('');
    setBadgeTag(
      request.requested_name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 25)
    );
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const reviewed = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Affiliation Requests</h2>
        {pending.length > 0 && (
          <Badge variant="secondary">{pending.length} pending</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading requests…
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Pending</h3>
            {pending.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No pending affiliation requests.
                </CardContent>
              </Card>
            ) : (
              pending.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  onApprove={() => openReview(req, 'approve')}
                  onDeny={() => openReview(req, 'deny')}
                />
              ))
            )}
          </section>

          {reviewed.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Reviewed</h3>
              {reviewed.map((req) => (
                <RequestCard key={req.id} request={req} />
              ))}
            </section>
          )}
        </>
      )}

      <Dialog
        open={!!reviewingRequest}
        onOpenChange={(open) => {
          if (!open) {
            setReviewingRequest(null);
            setAdminNotes('');
            setBadgeTag('');
            setReviewAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Affiliation' : 'Deny Request'}
            </DialogTitle>
          </DialogHeader>
          {reviewingRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Requested name</p>
                <p className="font-medium">{reviewingRequest.requested_name}</p>
              </div>
              {reviewingRequest.description_or_context && (
                <div>
                  <p className="text-sm text-muted-foreground">Context</p>
                  <p className="text-sm">{reviewingRequest.description_or_context}</p>
                </div>
              )}
              {reviewAction === 'approve' && (
                <div className="space-y-1">
                  <Label htmlFor="badge-tag">
                    Badge tag <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="badge-tag"
                    value={badgeTag}
                    onChange={(e) => setBadgeTag(e.target.value)}
                    placeholder="e.g. newstudio"
                    maxLength={25}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lowercase alphanumeric slug used to identify this affiliation on profiles.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="admin-notes">Admin notes (optional)</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes or reason for decision…"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewingRequest(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              disabled={reviewMutation.isPending}
              onClick={() => {
                if (!reviewingRequest || !reviewAction) return;
                reviewMutation.mutate({
                  id: reviewingRequest.id,
                  action: reviewAction,
                  notes: adminNotes,
                  tag: badgeTag,
                  name: reviewingRequest.requested_name,
                  userId: reviewingRequest.user_id,
                });
              }}
            >
              {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {reviewAction === 'approve' ? 'Approve & Add' : 'Deny'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface RequestCardProps {
  request: AffiliationRequest;
  onApprove?: () => void;
  onDeny?: () => void;
}

const RequestCard: React.FC<RequestCardProps> = ({ request, onApprove, onDeny }) => {
  const isPending = request.status === 'pending';
  const displayName = request.profile?.display_name ?? 'Unknown user';

  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-medium">{request.requested_name}</p>
            <p className="text-sm text-muted-foreground">
              Requested by {displayName} ·{' '}
              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            </p>
          </div>
          <Badge className={STATUS_COLORS[request.status] + ' border capitalize'} variant="outline">
            {request.status}
          </Badge>
        </div>
        {request.description_or_context && (
          <p className="text-sm text-muted-foreground italic">
            "{request.description_or_context}"
          </p>
        )}
        {!request.description_or_context && !isPending && (
          <p className="text-xs text-muted-foreground">No additional context provided.</p>
        )}
        {request.admin_notes && (
          <p className="text-xs text-muted-foreground border-l-2 pl-2">
            Admin note: {request.admin_notes}
          </p>
        )}
        {isPending && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={onApprove} className="gap-1">
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={onDeny} className="gap-1">
              <XCircle className="w-4 h-4" /> Deny
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AffiliationRequestsManager;
