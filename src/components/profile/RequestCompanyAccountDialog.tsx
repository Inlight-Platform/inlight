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
import { Building2, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

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
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long'),
});

interface Props {
  trigger?: React.ReactNode;
}

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

  const { data: existing, isLoading } = useQuery({
    queryKey: ['company-account-request', user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_account_requests')
        .select('*')
        .eq('requester_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');
      const parsed = requestSchema.parse({
        company_name: companyName,
        description,
        website_url: websiteUrl,
        justification,
        company_email: companyEmail,
        company_password: companyPassword,
      });
      const payload = {
        company_name: parsed.company_name,
        description: parsed.description || null,
        website_url: parsed.website_url || null,
        justification: parsed.justification,
        company_email: parsed.company_email.toLowerCase(),
        company_password: parsed.company_password,
      };
      if (existing && existing.status === 'pending') {
        const { error } = await supabase
          .from('company_account_requests')
          .update(payload)
          .eq('id', existing.id);
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
        existing?.status === 'pending'
          ? 'Request updated'
          : 'Request submitted — admins will review it shortly'
      );
      setCompanyName('');
      setDescription('');
      setWebsiteUrl('');
      setJustification('');
      setCompanyEmail('');
      setCompanyPassword('');
      queryClient.invalidateQueries({ queryKey: ['company-account-request', user?.id] });
    },
    onError: (err: any) => {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0]?.message || 'Invalid input');
      } else {
        toast.error(err.message || 'Failed to submit request');
      }
    },
  });

  const showForm =
    !existing || existing.status === 'denied' || existing.status === 'pending';

  // Prefill from existing pending request so user can add missing credentials
  React.useEffect(() => {
    if (existing && existing.status === 'pending') {
      setCompanyName((v) => v || existing.company_name || '');
      setDescription((v) => v || existing.description || '');
      setWebsiteUrl((v) => v || existing.website_url || '');
      setJustification((v) => v || existing.justification || '');
      setCompanyEmail((v) => v || (existing as any).company_email || '');
    }
  }, [existing]);

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
        ) : existing && existing.status === 'pending' ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending review — you can update your details below
            </div>
          </div>
        ) : existing && existing.status === 'approved' ? (
          <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Approved
            </div>
            <p className="text-sm text-muted-foreground">
              Your company account <span className="font-medium text-foreground">{existing.company_name}</span>{' '}
              is live.
            </p>
            {existing.created_company_id && (
              <Button
                size="sm"
                onClick={() => {
                  setOpen(false);
                  navigate(`/company/${existing.created_company_id}`);
                }}
              >
                Open Company Profile
              </Button>
            )}
          </div>
        ) : null}

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
            className="space-y-4"
          >
            {existing?.status === 'denied' && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Previous request denied
                </div>
                {existing.admin_notes && (
                  <p className="text-xs text-muted-foreground">Admin note: {existing.admin_notes}</p>
                )}
                <p className="text-xs text-muted-foreground">You can submit a new request below.</p>
              </div>
            )}

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
                  placeholder="At least 8 characters"
                  required
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
                Submit Request
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RequestCompanyAccountDialog;