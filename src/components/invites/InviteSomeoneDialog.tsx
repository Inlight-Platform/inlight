import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

interface Props {
  trigger: React.ReactNode;
}

export const InviteSomeoneDialog: React.FC<Props> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_platform_invite', {
        _email: email.trim(),
        _note: note.trim() || null,
      });
      if (error) throw error;
      const payload = data as { token: string; existing_user_id: string | null; inviter_name: string | null };

      if (!payload.existing_user_id) {
        const { error: fnErr } = await supabase.functions.invoke('send-invite-email', {
          body: {
            type: 'general',
            email: email.trim(),
            token: payload.token,
            inviter_name: payload.inviter_name,
            personal_note: note.trim() || null,
          },
        });
        if (fnErr) console.warn('Email send failed:', fnErr);
      }

      toast.success(payload.existing_user_id ? 'Invitation sent to their Inlight inbox' : 'Invitation email sent');
      setEmail('');
      setNote('');
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone to Inlight</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-note">Personal note (optional)</Label>
            <Textarea
              id="invite-note"
              placeholder="Hey, thought you'd love this community..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <Send className="w-4 h-4 mr-2" />
            {loading ? 'Sending...' : 'Send invite'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};