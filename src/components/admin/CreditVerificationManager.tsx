import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck, Check, X, ExternalLink, FileText, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAdminVerificationRequests } from '@/hooks/useCreditVerification';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface CreditData {
  id: string;
  project: string;
  role: string;
  year: number;
  company: string | null;
  user_id: string;
}

interface VerificationRequest {
  id: string;
  credit_id: string;
  user_id: string;
  materials_urls: string[];
  notes: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  credits: CreditData;
}

const CreditVerificationManager: React.FC = () => {
  const { pendingRequests, isLoading, approveRequest, denyRequest, isApproving, isDenying } = useAdminVerificationRequests();
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch user profiles for display
  const userIds = [...new Set((pendingRequests as VerificationRequest[]).map(r => r.user_id))];
  const { data: profiles = {} } = useQuery({
    queryKey: ['profiles-for-requests', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      return (data || []).reduce((acc, p) => ({ ...acc, [p.user_id!]: p }), {} as Record<string, any>);
    },
    enabled: userIds.length > 0,
  });

  const handleApprove = (requestId: string) => {
    approveRequest({ requestId, adminNotes });
    setDetailsOpen(false);
    setAdminNotes('');
    setSelectedRequest(null);
  };

  const handleDeny = (requestId: string) => {
    denyRequest({ requestId, adminNotes });
    setDetailsOpen(false);
    setAdminNotes('');
    setSelectedRequest(null);
  };

  const openDetails = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setAdminNotes('');
    setDetailsOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-600 gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
      case 'denied':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Denied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = (pendingRequests as VerificationRequest[]).filter(r => r.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Credit Verification Requests
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">{pendingCount} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (pendingRequests as VerificationRequest[]).length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No verification requests yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Materials</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pendingRequests as VerificationRequest[]).map((request) => {
                const profile = profiles[request.user_id];
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img
                          src={profile?.avatar_url || '/placeholder.svg'}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span className="font-medium">{profile?.display_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.credits.project}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.credits.role} • {request.credits.year}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {request.materials_urls.length > 0 ? (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="w-3 h-3" />
                          {request.materials_urls.length} file(s)
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetails(request)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Verification Request</DialogTitle>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-6 py-4">
                {/* User info */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <img
                    src={profiles[selectedRequest.user_id]?.avatar_url || '/placeholder.svg'}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">{profiles[selectedRequest.user_id]?.display_name || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">Submitted {format(new Date(selectedRequest.created_at), 'MMMM d, yyyy')}</p>
                  </div>
                </div>

                {/* Credit details */}
                <div>
                  <h4 className="font-medium mb-2">Credit Details</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border">
                    <div>
                      <p className="text-sm text-muted-foreground">Project</p>
                      <p className="font-medium">{selectedRequest.credits.project}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-medium">{selectedRequest.credits.role}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Year</p>
                      <p className="font-medium">{selectedRequest.credits.year}</p>
                    </div>
                    {selectedRequest.credits.company && (
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="font-medium">{selectedRequest.credits.company}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* User notes */}
                {selectedRequest.notes && (
                  <div>
                    <h4 className="font-medium mb-2">User Notes</h4>
                    <p className="p-4 rounded-lg bg-muted/50 text-sm">{selectedRequest.notes}</p>
                  </div>
                )}

                {/* Materials */}
                {selectedRequest.materials_urls.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Supporting Materials</h4>
                    <div className="space-y-2">
                      {selectedRequest.materials_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm flex-1 truncate">Material {i + 1}</span>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                {selectedRequest.status === 'pending' && (
                  <div>
                    <h4 className="font-medium mb-2">Admin Notes (optional)</h4>
                    <Textarea
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      placeholder="Add notes about your decision..."
                      rows={3}
                    />
                  </div>
                )}

                {/* Actions */}
                {selectedRequest.status === 'pending' ? (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={isApproving || isDenying}
                    >
                      {isApproving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Approve & Verify
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleDeny(selectedRequest.id)}
                      disabled={isApproving || isDenying}
                    >
                      {isDenying ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Deny
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm">
                      <strong>Decision:</strong> {getStatusBadge(selectedRequest.status)}
                    </p>
                    {selectedRequest.admin_notes && (
                      <p className="text-sm mt-2">
                        <strong>Notes:</strong> {selectedRequest.admin_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CreditVerificationManager;
