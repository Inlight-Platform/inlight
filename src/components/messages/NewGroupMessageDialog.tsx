import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface NewGroupMessageDialogProps {
  groupChatId: string;
  projectId: string;
}

const NewGroupMessageDialog: React.FC<NewGroupMessageDialogProps> = ({
  groupChatId,
  projectId,
}) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if current user is project creator
  const { data: project } = useQuery({
    queryKey: ['project-creator-check', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('creator_id')
        .eq('id', projectId)
        .single();
      return data;
    },
    enabled: !!projectId && open,
  });

  const isCreator = project?.creator_id === user?.id;

  // Fetch current group chat members
  const { data: chatMembers = [] } = useQuery({
    queryKey: ['group-chat-members', groupChatId],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('group_chat_members')
        .select('user_id')
        .eq('group_chat_id', groupChatId);

      if (!members || members.length === 0) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      return profiles || [];
    },
    enabled: !!groupChatId && open,
  });

  // Fetch creator's connections who are NOT in the chat (for adding new members)
  const { data: addableUsers = [] } = useQuery({
    queryKey: ['addable-chat-members', groupChatId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: connections } = await supabase
        .rpc('get_mutual_connections', { target_user_id: user.id });

      if (!connections || connections.length === 0) return [];

      const memberIds = chatMembers.map(m => m.user_id);
      const nonMemberIds = connections
        .map((c: { user_id: string }) => c.user_id)
        .filter((id: string) => !memberIds.includes(id));

      if (nonMemberIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', nonMemberIds);

      return profiles || [];
    },
    enabled: !!groupChatId && open && isCreator && chatMembers.length > 0,
  });

  // Add member to group chat
  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('group_chat_members')
        .insert({ group_chat_id: groupChatId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-chat-members', groupChatId] });
      queryClient.invalidateQueries({ queryKey: ['addable-chat-members', groupChatId] });
      toast.success('Member added to chat');
    },
    onError: () => toast.error('Failed to add member'),
  });

  const handleChatWithMember = (memberId: string) => {
    setOpen(false);
    navigate(`/messages/direct/${memberId}`);
  };

  // Filter out own user from chat members list
  const otherMembers = chatMembers.filter(m => m.user_id !== user?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Team Chat Options</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Chat with member section */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat with member
            </h3>
            {otherMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No other members yet</p>
            ) : (
              <div className="space-y-1">
                {otherMembers.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => handleChatWithMember(member.user_id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>{member.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.display_name || 'Unknown'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add new member section - only for creator */}
          {isCreator && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add new member
              </h3>
              {addableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No connections available to add</p>
              ) : (
                <div className="space-y-1">
                  {addableUsers.map(u => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback>{u.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{u.display_name || 'Unknown'}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addMember.mutate(u.user_id)}
                        disabled={addMember.isPending}
                      >
                        {addMember.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Add'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewGroupMessageDialog;
