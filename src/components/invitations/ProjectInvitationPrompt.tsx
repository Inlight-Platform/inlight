import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Mail, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface ProjectInvitationPromptProps {
  projectId: string;
  projectTitle: string;
}

interface PendingProjectInvitation {
  id: string;
  roleName: string;
}

export const ProjectInvitationPrompt: React.FC<ProjectInvitationPromptProps> = ({
  projectId,
  projectTitle,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invitation, isLoading } = useQuery({
    queryKey: ['project-pending-invitation', projectId, user?.id],
    queryFn: async (): Promise<PendingProjectInvitation | null> => {
      if (!user?.id) return null;

      const { data: roles, error: rolesError } = await supabase
        .from('project_roles')
        .select('id, role_name')
        .eq('project_id', projectId);

      if (rolesError) throw rolesError;
      if (!roles?.length) return null;

      const { data: invitations, error: invitationError } = await supabase
        .from('project_invitations')
        .select('id, project_role_id')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .in('project_role_id', roles.map((role) => role.id))
        .order('created_at', { ascending: false })
        .limit(1);

      if (invitationError) throw invitationError;

      const pendingInvitation = invitations?.[0];
      if (!pendingInvitation) return null;

      const role = roles.find((item) => item.id === pendingInvitation.project_role_id);
      return {
        id: pendingInvitation.id,
        roleName: role?.role_name || 'a role',
      };
    },
    enabled: !!user?.id && !!projectId,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!invitation) return;

      const { error } = await (supabase as any).rpc('accept_project_invitation', {
        _invitation_id: invitation.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pending-invitation', projectId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['open-roles', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-role-invitations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-invitations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success(`You've joined "${projectTitle}" as ${invitation?.roleName}!`);
    },
    onError: () => {
      toast.error('Failed to accept invitation');
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!invitation) return;

      const { error } = await supabase
        .from('project_invitations')
        .update({ status: 'declined' })
        .eq('id', invitation.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pending-invitation', projectId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['open-roles', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-invitations', user?.id] });
      toast.success('Invitation declined');
    },
    onError: () => {
      toast.error('Failed to decline invitation');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking invitation...
        </CardContent>
      </Card>
    );
  }

  if (!invitation) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium">You've been invited to join this project.</p>
            <p className="text-sm text-muted-foreground">
              Accept to join {projectTitle} as {invitation.roleName}.
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-shrink-0">
          <Button
            size="sm"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || declineMutation.isPending}
          >
            {acceptMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => declineMutation.mutate()}
            disabled={acceptMutation.isPending || declineMutation.isPending}
          >
            <X className="mr-2 h-4 w-4" />
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
