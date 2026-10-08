import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Lock, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMyGroups } from '@/hooks/useGroups';
import { AudienceSelector } from './AudienceSelector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type ContentAudience = 'private' | 'public' | 'network' | 'specific' | 'group';
type SelectedUser = { user_id: string; display_name: string | null; avatar_url: string | null };

interface Props {
  contentType: 'event' | 'project';
  contentId: string;
  visibility?: string | null;
  compact?: boolean;
  onChanged?: (visibility: ContentAudience) => void;
}

const baseOptions = [
  { value: 'private' as const, label: 'Private', description: 'Only you', icon: Lock },
  { value: 'public' as const, label: 'Everyone', description: 'Visible to all users', icon: Globe },
  { value: 'network' as const, label: 'My Network', description: 'Only your connections', icon: Users },
  { value: 'specific' as const, label: 'Specific People', description: 'Choose who can see this', icon: UserCheck },
];

export const ContentAudienceControl = ({ contentType, contentId, visibility, compact = false, onChanged }: Props) => {
  const { user } = useAuth();
  const { data: myGroups = [] } = useMyGroups();
  const queryClient = useQueryClient();
  const [specificOpen, setSpecificOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const current: ContentAudience = ['public', 'network', 'specific', 'group'].includes(visibility || '')
    ? visibility as ContentAudience
    : 'private';
  const selected = baseOptions.find((option) => option.value === current) || baseOptions[0];
  const SelectedIcon = selected.icon;
  const eligibleGroups = myGroups.filter((group) => group.is_faculty || group.members_can_post);

  const mutation = useMutation({
    mutationFn: async ({ audience, groupId, recipients = [] }: { audience: ContentAudience; groupId?: string; recipients?: SelectedUser[] }) => {
      const recipientTable = contentType === 'event' ? 'event_recipients' : 'project_recipients';
      const recipientColumn = contentType === 'event' ? 'event_id' : 'project_id';
      const groupTable = contentType === 'event' ? 'event_groups' : 'project_groups';
      const groupContentColumn = contentType === 'event' ? 'event_id' : 'project_id';

      const { error: recipientDeleteError } = await supabase.from(recipientTable).delete().eq(recipientColumn, contentId);
      if (recipientDeleteError) throw recipientDeleteError;
      const { error: groupDeleteError } = await supabase.from(groupTable).delete().eq(groupContentColumn, contentId);
      if (groupDeleteError) throw groupDeleteError;

      if (contentType === 'event') {
        const { error } = await supabase.from('events').update({ visibility: audience }).eq('id', contentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('projects').update({ visibility: audience, is_public: audience === 'public' }).eq('id', contentId);
        if (error) throw error;
      }

      if (audience === 'specific' && recipients.length) {
        const { error } = await supabase.from(recipientTable).insert(
          recipients.map((recipient) => ({ [recipientColumn]: contentId, recipient_id: recipient.user_id })),
        );
        if (error) throw error;
      }
      if (audience === 'group' && groupId) {
        const { error } = await supabase.from(groupTable).insert({ [groupContentColumn]: contentId, group_id: groupId });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed-events'] });
      queryClient.invalidateQueries({ queryKey: ['feed-projects-all'] });
      queryClient.invalidateQueries({ queryKey: ['feed-route-event'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['group-events'] });
      queryClient.invalidateQueries({ queryKey: ['group-projects'] });
      setSpecificOpen(false);
      setSelectedUsers([]);
      onChanged?.(variables.audience);
      toast.success('Audience updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Unable to change audience'),
  });

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={compact ? 'icon' : 'sm'} className={compact ? 'h-8 w-8' : 'gap-1.5'} disabled={mutation.isPending} title={`Audience: ${selected.label}`}>
            <SelectedIcon className="h-4 w-4" />
            {!compact && <span>{selected.label}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {baseOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem key={option.value} onSelect={() => option.value === 'specific' ? setSpecificOpen(true) : mutation.mutate({ audience: option.value })} className="gap-3">
                <Icon className="h-4 w-4" />
                <div><p className="font-medium">{option.label}</p><p className="text-xs text-muted-foreground">{option.description}</p></div>
              </DropdownMenuItem>
            );
          })}
          {eligibleGroups.map((group) => (
            <DropdownMenuItem key={group.id} onSelect={() => mutation.mutate({ audience: 'group', groupId: group.id })} className="gap-3">
              <Lock className="h-4 w-4" />
              <div><p className="font-medium">{group.name}</p><p className="text-xs text-muted-foreground">Only {group.name} members</p></div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={specificOpen} onOpenChange={setSpecificOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Choose specific people</DialogTitle></DialogHeader>
          <AudienceSelector visibility="specific" onVisibilityChange={() => undefined} selectedUsers={selectedUsers} onSelectedUsersChange={setSelectedUsers} currentUserId={user.id} allowedVisibilities={['specific']} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecificOpen(false)}>Cancel</Button>
            <Button disabled={!selectedUsers.length || mutation.isPending} onClick={() => mutation.mutate({ audience: 'specific', recipients: selectedUsers })}>Save audience</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
