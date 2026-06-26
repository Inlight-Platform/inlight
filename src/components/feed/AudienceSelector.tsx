import React, { useState } from 'react';
import { Globe, Users, UserCheck, X, Search, Loader2, Lock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type PostVisibility = 'public' | 'network' | 'specific' | 'group';

interface SelectedUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AudienceSelectorProps {
  visibility: PostVisibility;
  onVisibilityChange: (v: PostVisibility) => void;
  selectedUsers: SelectedUser[];
  onSelectedUsersChange: (users: SelectedUser[]) => void;
  currentUserId: string;
  /** Groups the current user can post into. When non-empty a "{group} only" option is added. */
  availableGroups?: { id: string; name: string }[];
  selectedGroupId?: string | null;
  onSelectedGroupChange?: (groupId: string | null) => void;
}

export const AudienceSelector: React.FC<AudienceSelectorProps> = ({
  visibility,
  onVisibilityChange,
  selectedUsers,
  onSelectedUsersChange,
  currentUserId,
  availableGroups = [],
  selectedGroupId = null,
  onSelectedGroupChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ['user-search-audience', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .ilike('display_name', `%${searchQuery}%`)
        .neq('user_id', currentUserId)
        .limit(10);
      if (error) throw error;
      return (data || []).filter(
        (p) => !selectedUsers.some((s) => s.user_id === p.user_id)
      );
    },
    enabled: searchQuery.length >= 2,
  });

  const baseOptions: { value: PostVisibility; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'public', label: 'Everyone', icon: <Globe className="h-4 w-4" />, desc: 'Visible to all users' },
    { value: 'network', label: 'My Network', icon: <Users className="h-4 w-4" />, desc: 'Only your connections' },
    { value: 'specific', label: 'Specific People', icon: <UserCheck className="h-4 w-4" />, desc: 'Choose who can see this' },
  ];
  const groupOptions: { value: PostVisibility; label: string; icon: React.ReactNode; desc: string }[] =
    availableGroups.map((g) => ({
      value: 'group' as PostVisibility,
      label: `${g.name} only`,
      icon: <Lock className="h-4 w-4" />,
      desc: `Only visible to ${g.name} members`,
    }));
  const options = [...baseOptions, ...groupOptions];

  const currentOption =
    visibility === 'group'
      ? groupOptions.find((_, i) => availableGroups[i]?.id === selectedGroupId) ?? groupOptions[0] ?? baseOptions[0]
      : baseOptions.find((o) => o.value === visibility)!;

  const handleSelect = (v: PostVisibility, groupId?: string) => {
    onVisibilityChange(v);
    if (v === 'group') {
      onSelectedGroupChange?.(groupId ?? null);
      onSelectedUsersChange([]);
      setShowUserSearch(false);
    } else if (v !== 'specific') {
      onSelectedGroupChange?.(null);
      onSelectedUsersChange([]);
      setShowUserSearch(false);
    } else {
      onSelectedGroupChange?.(null);
      setShowUserSearch(true);
    }
  };

  const addUser = (user: SelectedUser) => {
    onSelectedUsersChange([...selectedUsers, user]);
    setSearchQuery('');
  };

  const removeUser = (userId: string) => {
    onSelectedUsersChange(selectedUsers.filter((u) => u.user_id !== userId));
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 text-xs">
            {currentOption.icon}
            {currentOption.label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {baseOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
                visibility === opt.value
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              {opt.icon}
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
          {availableGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleSelect('group', g.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
                visibility === 'group' && selectedGroupId === g.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              <Lock className="h-4 w-4" />
              <div>
                <p className="font-medium">{g.name} only</p>
                <p className="text-xs text-muted-foreground">Private to {g.name}</p>
              </div>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Specific people selector */}
      {visibility === 'specific' && (
        <div className="space-y-2">
          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <Badge key={u.user_id} variant="secondary" className="gap-1 pr-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">{u.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs max-w-[100px] truncate">{u.display_name || 'User'}</span>
                  <button
                    type="button"
                    onClick={() => removeUser(u.user_id)}
                    className="p-0.5 hover:bg-accent rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search people to add..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search results */}
          {searchQuery.length >= 2 && searchResults.length > 0 && (
            <div className="border border-border rounded-md max-h-40 overflow-y-auto">
              {searchResults.map((profile) => (
                <button
                  key={profile.user_id}
                  type="button"
                  onClick={() => addUser(profile)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left text-sm"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{profile.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{profile.display_name || 'Unknown'}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <p className="text-xs text-muted-foreground text-center py-2">No users found</p>
          )}
        </div>
      )}
    </div>
  );
};
