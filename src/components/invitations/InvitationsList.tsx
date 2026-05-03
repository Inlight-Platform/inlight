import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { InvitationCard } from './InvitationCard';
import { Loader2, Mail } from 'lucide-react';

export const InvitationsList: React.FC = () => {
  const { user } = useAuth();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['my-invitations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch invitations where current user is the receiver
      const { data: invitationData, error } = await supabase
        .from('project_invitations')
        .select('id, status, created_at, project_role_id, sender_id')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!invitationData?.length) return [];

      // Fetch project roles
      const roleIds = invitationData.map(i => i.project_role_id);
      const { data: roles } = await supabase
        .from('project_roles')
        .select('id, role_name, project_id')
        .in('id', roleIds);

      if (!roles?.length) return [];

      // Fetch projects
      const projectIds = [...new Set(roles.map(r => r.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, main_image_url, header_image_url')
        .in('id', projectIds);

      // Fetch sender profiles
      const senderIds = [...new Set(invitationData.map(i => i.sender_id))];
      const { data: senderProfiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', senderIds);

      // Build the complete invitation objects
      const projectMap = new Map(projects?.map(p => [p.id, p]) || []);
      const roleMap = new Map(roles.map(r => [r.id, r]));
      const senderMap = new Map(senderProfiles?.map(s => [s.user_id, s]) || []);

      return invitationData.map(inv => {
        const role = roleMap.get(inv.project_role_id);
        const project = role ? projectMap.get(role.project_id) : null;
        const sender = senderMap.get(inv.sender_id);

        return {
          id: inv.id,
          status: inv.status,
          created_at: inv.created_at,
          project_role: {
            id: role?.id || '',
            role_name: role?.role_name || 'Unknown Role',
            project: {
              id: project?.id || '',
              title: project?.title || 'Unknown Project',
              main_image_url: project?.main_image_url || null,
              header_image_url: project?.header_image_url || null,
            },
          },
          sender: {
            user_id: sender?.user_id || inv.sender_id,
            display_name: sender?.display_name || null,
            avatar_url: sender?.avatar_url || null,
          },
        };
      }).filter(inv => inv.project_role.project.id); // Filter out incomplete data
    },
    enabled: !!user?.id,
  });

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending');

  if (pendingInvitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Project Invitations</h2>
        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
          {pendingInvitations.length}
        </span>
      </div>
      <div className="space-y-3">
        {pendingInvitations.map((invitation) => (
          <InvitationCard
            key={invitation.id}
            invitation={invitation}
            currentUserId={user.id}
          />
        ))}
      </div>
    </div>
  );
};
