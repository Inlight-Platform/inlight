import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, Clock, CheckCircle2, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';

const requestSchema = z.object({
  company_name: z.string().trim().min(2, 'Name required').max(100, 'Max 100 characters'),
  description: z.string().trim().max(500, 'Max 500 characters').optional(),
  website_url: z
    .string()
    .trim()
    .max(255)
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  justification: z
    .string()
    .trim()
    .min(20, 'Tell us a bit more (20+ chars)')
    .max(1000, 'Max 1000 characters'),
  company_email: z.string().trim().email('Valid email required').max(255),
  company_password: z
    .string()
    .max(72, 'Password too long')
    .optional(),
});

interface Props {
  trigger?: React.ReactNode;
}

type CompanyAccountRequest = {
  id: string;
  requester_id: string;
  company_name: string;
  description: string | null;
  website_url: string | null;
  justification: string;
  company_email?: string | null;
  company_password?: string | null;
  status: 'pending' | 'approved' | 'denied';
  admin_notes: string | null;
  created_company_id: string | null;
  created_at: string;
};

export const RequestCompanyAccountDialog: React.FC<Props> = ({ trigger }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [justification, setJustification] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPassword, setCompanyPassword] = useState('');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingRequestId(null);
    setCompanyName('');
    setDescription('');
    setWebsiteUrl('');
    setJustification('');
    setCompanyEmail('');
    setCompanyPassword('');
  };

  const editRequest = (request: CompanyAccountRequest) => {
    setEditingRequestId(request.id);
    setCompanyName(request.company_name || '');
    setDescription(request.description || '');
    setWebsiteUrl(request.website_url || '');
    setJustification(request.justification || '');
    setCompanyEmail(request.company_email || '');
    setCompanyPassword('');
  };

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['company-account-requests', user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_account_requests')
        .select('*')
        .eq('requester_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CompanyAccountRequest[];
    },
  });

  const editingRequest = requests.find((request) => request.id === editingRequestId);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      const parsed = requestSchema.parse({
        company_name: companyName,
        description,
        website_url: websiteUrl,
        justification,
        company_email: companyEmail,
        company_password: companyPassword || undefined,
      });
      if (!editingRequest && !parsed.company_password) {
        throw new Error('Password must be at least 8 characters');
      }
      if (parsed.company_password && parsed.company_password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const payload = {
        company_name: parsed.company_name,
        description: parsed.description || null,
        website_url: parsed.website_url || null,
        justification: parsed.justification,
        company_email: parsed.company_email.toLowerCase(),
        ...(parsed.company_password ? { company_password: parsed.company_password } : {}),
      };
      if (editingRequest && editingRequest.status === 'pending') {
        const { error } = await supabase
          .from('company_account_requests')
          .update(payload)
          .eq('id', editingRequest.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_account_requests')
          .insert({ requester_id: user.id, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        editingRequest?.status === 'pending'
          ? 'Request updated'
          : 'Request submitted — admins will review it shortly'
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['company-account-requests', user?.id] });
    },
    onError: (err: any) => {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0]?.message || 'Invalid input');
      } else {
        toast.error(err.message || 'Failed to submit request');
      }
    },
  });

  const formTitle = editingRequest ? `Edit request for ${editingRequest.company_name}` : 'New company request';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Building2 className="h-4 w-4" />
            Request Company Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Request a Company Account
          </DialogTitle>
          <DialogDescription>
            Company accounts let organizations have their own profile, post projects, and
            be followed. Admins review every request.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Your requests</h3>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={resetForm}>
                <Plus className="h-3.5 w-3.5" />
                New request
              </Button>
            </div>
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-border bg-card/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-sm truncate">{request.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </p>
                      {request.company_email && (
                        <p className="text-xs text-muted-foreground truncate">{request.company_email}</p>
                      )}
                    </div>
                    <Badge
                      variant={
                        request.status === 'approved'
                          ? 'default'
                          : request.status === 'denied'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="shrink-0"
                    >
                      {request.status}
                    </Badge>
                  </div>
                  {request.admin_notes && (
                    <p className="mt-2 text-xs text-muted-foreground">Admin note: {request.admin_notes}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.status === 'pending' && (
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => editRequest(request)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit pending request
                      </Button>
                    )}
                    {request.status === 'approved' && request.created_company_id && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setOpen(false);
                          navigate(`/company/${request.created_company_id}`);
                        }}
                      >
                        Open Company Profile
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="space-y-4 border-t border-border pt-4"
        >
            <div className="flex items-center gap-2">
              {editingRequest ? (
                <Clock className="h-4 w-4 text-amber-500" />
              ) : (
                <Building2 className="h-4 w-4 text-primary" />
              )}
              <h3 className="text-sm font-semibold">{formTitle}</h3>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company_name">Company name *</Label>
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={100}
                placeholder="A Lab Theater"
                required
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                These credentials will become the login for your company account on Inlight once approved.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="company_email">Company login email *</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  maxLength={255}
                  placeholder="hello@yourcompany.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_password">Company login password *</Label>
                <Input
                  id="company_password"
                  type="password"
                  value={companyPassword}
                  onChange={(e) => setCompanyPassword(e.target.value)}
                  maxLength={72}
                  placeholder={editingRequest ? 'Leave blank to keep current password' : 'At least 8 characters'}
                  required={!editingRequest}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website_url">Website (optional)</Label>
              <Input
                id="website_url"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                maxLength={255}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Short description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="What does this company do?"
              />
              <div className="text-xs text-muted-foreground text-right">
                {description.length}/500
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="justification">Why do you need this account? *</Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Your role at the company, what you'll use the account for, etc."
                required
              />
              <div className="text-xs text-muted-foreground text-right">
                {justification.length}/1000
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRequest ? 'Update Request' : 'Submit Request'}
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
};

export default RequestCompanyAccountDialog;
