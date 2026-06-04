import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

interface Props {
  projectId: string;
  projectTitle: string;
  trigger: React.ReactNode;
}

export const InviteCreditDialog: React.FC<Props> = ({ projectId, projectTitle, trigger }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !role.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_project_credit_invite', {
        _project_id: projectId,
        _email: email.trim(),
        _role_name: role.trim(),
      });
      if (error) throw error;
      const payload = data as {
        token: string;
        existing_user_id: string | null;
        inviter_name: string | null;
        project_title: string | null;
      };

      if (!payload.existing_user_id) {
        const { error: fnErr } = await supabase.functions.invoke('send-invite-email', {
          body: {
            type: 'credit',
            email: email.trim(),
            token: payload.token,
            inviter_name: payload.inviter_name,
            project_title: payload.project_title || projectTitle,
            role_name: role.trim(),
          },
        });
        if (fnErr) console.warn('Email send failed:', fnErr);
      }

      toast.success(
        payload.existing_user_id
          ? 'Invitation delivered to their Inlight inbox'
          : 'Credit invitation email sent'
      );
      setEmail('');
      setRole('');
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a collaborator</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Send an invitation to claim a credit on <strong>{projectTitle}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="credit-invite-email">Email</Label>
            <Input
              id="credit-invite-email"
              type="email"
              required
              placeholder="collaborator@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-invite-role">Role on this project</Label>
            <Input
              id="credit-invite-role"
              required
              placeholder="e.g. Director of Photography"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <Mail className="w-4 h-4 mr-2" />
            {loading ? 'Sending...' : 'Send credit invitation'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};