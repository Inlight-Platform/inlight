import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserSearchInput } from './UserSearchInput';

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

export interface RoleSlot {
  id: string;
  roleName: string;
  assignedUser: Profile | null;
}

interface RoleSlotBuilderProps {
  roles: RoleSlot[];
  onChange: (roles: RoleSlot[]) => void;
  excludeUserIds?: string[];
}

export const RoleSlotBuilder: React.FC<RoleSlotBuilderProps> = ({
  roles,
  onChange,
  excludeUserIds = [],
}) => {
  const addRoleSlot = () => {
    onChange([
      ...roles,
      {
        id: `role-${Date.now()}`,
        roleName: '',
        assignedUser: null,
      },
    ]);
  };

  const removeRoleSlot = (id: string) => {
    onChange(roles.filter((r) => r.id !== id));
  };

  const updateRoleName = (id: string, name: string) => {
    onChange(
      roles.map((r) => (r.id === id ? { ...r, roleName: name } : r))
    );
  };

  const updateAssignedUser = (id: string, user: Profile | null) => {
    onChange(
      roles.map((r) => (r.id === id ? { ...r, assignedUser: user } : r))
    );
  };

  // Get all assigned user IDs to exclude from other slots
  const assignedUserIds = roles
    .filter((r) => r.assignedUser)
    .map((r) => r.assignedUser!.user_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Open Roles (Optional)</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Add roles you are still looking to fill. Public project roles appear on Jobs.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRoleSlot}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
          No open roles added yet. You can create the project without adding roles.
        </p>
      ) : (
        <div className="space-y-4">
          {roles.map((role, index) => (
            <div
              key={role.id}
              className="p-4 border border-border rounded-lg space-y-3 bg-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Role #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRoleSlot(role.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`role-name-${role.id}`}>Role Title</Label>
                <Input
                  id={`role-name-${role.id}`}
                  placeholder="e.g., Director, DP, Gaffer..."
                  value={role.roleName}
                  onChange={(e) => updateRoleName(role.id, e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Invite Someone (Optional)</Label>
                <UserSearchInput
                  value={role.assignedUser}
                  onChange={(user) => updateAssignedUser(role.id, user)}
                  placeholder="Search to invite someone..."
                  excludeUserIds={[
                    ...excludeUserIds,
                    ...assignedUserIds.filter((id) => id !== role.assignedUser?.user_id),
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
