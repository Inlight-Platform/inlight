import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  status: string;
  created_at: string;
  project_role: {
    id: string;
    role_name: string;
    project: {
      id: string;
      title: string;
      main_image_url: string | null;
    };
  };
  sender: {
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface InvitationCardProps {
  invitation: Invitation;
  currentUserId: string;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  currentUserId,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      // Update invitation status
      const { error: invError } = await supabase
        .from('project_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (invError) throw invError;

      // Update project role with assigned user
      const { error: roleError } = await supabase
        .from('project_roles')
        .update({ assigned_user_id: currentUserId })
        .eq('id', invitation.project_role.id);

      if (roleError) throw roleError;

      // Add user as project member
      await supabase.from('project_members').insert({
        project_id: invitation.project_role.project.id,
        user_id: currentUserId,
        role: invitation.project_role.role_name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['project-roles'] });
      toast.success(`You've joined "${invitation.project_role.project.title}" as ${invitation.project_role.role_name}!`);
    },
    onError: () => {
      toast.error('Failed to accept invitation');
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      // Update invitation status
      const { error: invError } = await supabase
        .from('project_invitations')
        .update({ status: 'declined' })
        .eq('id', invitation.id);

      if (invError) throw invError;

      // Clear assigned user from role
      await supabase
        .from('project_roles')
        .update({ assigned_user_id: null })
        .eq('id', invitation.project_role.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
      toast.success('Invitation declined');
    },
    onError: () => {
      toast.error('Failed to decline invitation');
    },
  });

  const isPending = invitation.status === 'pending';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Project image */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {invitation.project_role.project.main_image_url ? (
              <img
                src={invitation.project_role.project.main_image_url}
                alt={invitation.project_role.project.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                No image
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground line-clamp-1">
                  {invitation.project_role.project.title}
                </h3>
                <p className="text-sm text-primary font-medium">
                  Role: {invitation.project_role.role_name}
                </p>
              </div>
              <button
                onClick={() => navigate(`/projects/${invitation.project_role.project.id}`)}
                className="p-1 hover:bg-accent rounded-full transition-colors flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Sender info */}
            <div className="flex items-center gap-2 mt-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={invitation.sender.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {invitation.sender.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                Invited by {invitation.sender.display_name || 'Unknown'}
              </span>
            </div>

            {/* Actions */}
            {isPending && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending || declineMutation.isPending}
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => declineMutation.mutate()}
                  disabled={acceptMutation.isPending || declineMutation.isPending}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-1" />
                  Decline
                </Button>
              </div>
            )}

            {invitation.status === 'accepted' && (
              <p className="text-sm text-green-600 mt-2 font-medium">✓ Accepted</p>
            )}
            {invitation.status === 'declined' && (
              <p className="text-sm text-muted-foreground mt-2">Declined</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
