import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MailPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface InviteFriendDialogProps {
  children: React.ReactNode;
  projectId?: string;
  projectTitle?: string;
}

export const InviteFriendDialog: React.FC<InviteFriendDialogProps> = ({
  children,
  projectId,
  projectTitle,
}) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleName, setRoleName] = useState('');
  const [note, setNote] = useState('');
  const isProjectInvite = Boolean(projectId);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const functionName = isProjectInvite ? 'send-project-credit-invite' : 'send-platform-invite';
      const body = isProjectInvite
        ? {
            email,
            projectId,
            roleName,
            note: note || undefined,
          }
        : {
            email,
            note: note || undefined,
          };

      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) {
        let message: string | undefined;
        try {
          const responseBody = await (error.context as Response)?.json();
          message = responseBody?.error;
        } catch {}
        throw new Error(message || error.message || 'Failed to send invite');
      }
      return data as { invite?: { email?: string }; inviteUrl?: string; alreadyMember?: boolean };
    },
    onSuccess: (data) => {
      toast.success(
        data.alreadyMember
          ? `${data.invite?.email || email} is already on Inlight!`
          : `Invite sent to ${data.invite?.email || email}`
      );
      setEmail('');
      setRoleName('');
      setNote('');
      setOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to send invite';
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isProjectInvite ? 'Invite someone to claim credit' : 'Invite a friend'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMutation.mutate();
          }}
        >
          {projectTitle && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Project: </span>
              <span className="font-medium">{projectTitle}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="friend-invite-email">Email</Label>
            <Input
              id="friend-invite-email"
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {isProjectInvite && (
            <div className="space-y-2">
              <Label htmlFor="friend-invite-role">Credit / role</Label>
              <Input
                id="friend-invite-role"
                placeholder="Director of Photography"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="friend-invite-note">Note</Label>
            <Textarea
              id="friend-invite-note"
              placeholder={isProjectInvite ? 'Optional message about the project' : 'Optional personal note'}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={inviteMutation.isPending || !email.trim() || (isProjectInvite && !roleName.trim())}
          >
            {inviteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MailPlus className="h-4 w-4" />
            )}
            Send invite
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
