import React, { useState } from 'react';
import { Lock, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type AuthorIdentityMode = 'personal' | 'group';

interface AuthorIdentitySelectorProps {
  identityMode: AuthorIdentityMode;
  onIdentityModeChange: (mode: AuthorIdentityMode) => void;
  personalLabel: string;
  availableGroups: { id: string; name: string }[];
  selectedGroupId: string | null;
  onSelectedGroupChange: (groupId: string | null) => void;
}

export const AuthorIdentitySelector: React.FC<AuthorIdentitySelectorProps> = ({
  identityMode,
  onIdentityModeChange,
  personalLabel,
  availableGroups,
  selectedGroupId,
  onSelectedGroupChange,
}) => {
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const selectedGroup = availableGroups.find((group) => group.id === selectedGroupId) ?? null;
  const filteredGroups = availableGroups.filter((group) =>
    group.name.toLowerCase().includes(groupSearchQuery.trim().toLowerCase())
  );

  const handleModeChange = (value: string) => {
    const nextMode = value === 'group' ? 'group' : 'personal';
    onIdentityModeChange(nextMode);
    if (nextMode === 'personal') {
      onSelectedGroupChange(null);
      setGroupSearchQuery('');
    }
  };

  const selectGroup = (groupId: string) => {
    onSelectedGroupChange(groupId);
    setGroupSearchQuery('');
  };

  return (
    <div className="space-y-2">
      <Select value={identityMode} onValueChange={handleModeChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose an identity" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border z-50">
          <SelectItem value="personal">{personalLabel}</SelectItem>
          <SelectItem value="group">Post as group admin</SelectItem>
        </SelectContent>
      </Select>

      {identityMode === 'group' && (
        <div className="space-y-2">
          {selectedGroup && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="gap-1 pr-1">
                <Lock className="h-3 w-3" />
                <span className="text-xs max-w-[180px] truncate">{selectedGroup.name}</span>
                <button
                  type="button"
                  onClick={() => onSelectedGroupChange(null)}
                  className="p-0.5 hover:bg-accent rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search groups to add..."
              value={groupSearchQuery}
              onChange={(event) => setGroupSearchQuery(event.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {groupSearchQuery.trim().length > 0 && filteredGroups.length > 0 && (
            <div className="border border-border rounded-md max-h-40 overflow-y-auto">
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectGroup(group.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left text-sm"
                >
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{group.name}</span>
                </button>
              ))}
            </div>
          )}

          {groupSearchQuery.trim().length > 0 && filteredGroups.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No groups found</p>
          )}
        </div>
      )}
    </div>
  );
};
