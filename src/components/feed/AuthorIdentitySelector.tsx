import React from 'react';
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
  const selectedIdentity = identityMode === 'group' && selectedGroupId
    ? `group:${selectedGroupId}`
    : 'personal';

  const handleIdentityChange = (value: string) => {
    if (value === 'personal') {
      onIdentityModeChange('personal');
      onSelectedGroupChange(null);
      return;
    }

    const groupId = value.startsWith('group:') ? value.slice('group:'.length) : null;
    if (groupId && availableGroups.some((group) => group.id === groupId)) {
      onIdentityModeChange('group');
      onSelectedGroupChange(groupId);
    }
  };

  return (
    <Select value={selectedIdentity} onValueChange={handleIdentityChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choose an identity" />
      </SelectTrigger>
      <SelectContent className="z-50 border-border bg-popover">
        <SelectItem value="personal">{personalLabel}</SelectItem>
        {availableGroups.map((group) => (
          <SelectItem key={group.id} value={`group:${group.id}`}>
            Group admin of {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
