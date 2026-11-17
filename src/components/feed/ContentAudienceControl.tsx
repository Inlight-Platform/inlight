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
  const selected = contentType === 'project' && visibility == null
    ? { value: 'private' as const, label: 'Legacy audience', description: 'Existing audience', icon: Lock }
    : current === 'group'
      ? { value: 'group' as const, label: 'Group Only', description: 'Department members only', icon: Lock }
      : baseOptions.find((option) => option.value === current) || baseOptions[0];
  const SelectedIcon = selected.icon;
  const eligibleGroups = myGroups.filter((group) => group.is_faculty || group.members_can_post);

  const mutation = useMutation({
    mutationFn: async ({ audience, groupId, recipients = [] }: { audience: ContentAudience; groupId?: string; recipients?: SelectedUser[] }) => {
      if (contentType === 'project') {
        const { error } = await supabase.rpc('set_project_audience' as never, {
          target_project_id: contentId,
          target_audience: audience,
          target_group_id: groupId || null,
          target_recipient_ids: recipients.map((recipient) => recipient.user_id),
        } as never);
        if (error) throw error;
        return;
      }
      const { error: recipientDeleteError } = await supabase.from('event_recipients').delete().eq('event_id', contentId);
      if (recipientDeleteError) throw recipientDeleteError;
      const { error: groupDeleteError } = await supabase.from('event_groups').delete().eq('event_id', contentId);
      if (groupDeleteError) throw groupDeleteError;

      const { error: visibilityError } = await supabase.from('events').update({ visibility: audience }).eq('id', contentId);
      if (visibilityError) throw visibilityError;

      if (audience === 'specific' && recipients.length) {
        const { error } = await supabase.from('event_recipients').insert(
          recipients.map((recipient) => ({ event_id: contentId, recipient_id: recipient.user_id })),
        );
        if (error) throw error;
      }
      if (audience === 'group' && groupId) {
        const { error } = await supabase.from('event_groups').insert({ event_id: contentId, group_id: groupId });
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
                <div><p className="font-medium">{option.label}</p><p className="text-xs text-muted-foreground">{contentType === 'project' && option.value === 'private' ? 'You and project collaborators' : option.description}</p></div>
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
