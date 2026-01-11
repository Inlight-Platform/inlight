import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/store/useStore';
import { cn } from '@/lib/utils';

interface OpportunityFiltersProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  selectedRole: UserRole | null;
  onRoleChange: (role: UserRole | null) => void;
  paidOnly: boolean;
  onPaidChange: (value: boolean) => void;
  remoteOnly: boolean;
  onRemoteChange: (value: boolean) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const roles: (UserRole | null)[] = [null, 'Actor', 'Producer', 'Director', 'Musician'];

const OpportunityFilters: React.FC<OpportunityFiltersProps> = ({
  keyword,
  onKeywordChange,
  selectedRole,
  onRoleChange,
  paidOnly,
  onPaidChange,
  remoteOnly,
  onRemoteChange,
  onClearFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search opportunities..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          className="pl-10 bg-card border-border"
          aria-label="Search opportunities"
        />
      </div>
      
      {/* Role pills */}
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role || 'all'}
            onClick={() => onRoleChange(role)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              selectedRole === role
                ? "bg-[#00FF87] text-black"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            )}
            aria-pressed={selectedRole === role}
          >
            {role || 'All'}
          </button>
        ))}
      </div>
      
      {/* Toggles */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="paid-only"
            checked={paidOnly}
            onCheckedChange={onPaidChange}
            aria-describedby="paid-only-desc"
          />
          <Label htmlFor="paid-only" className="text-sm cursor-pointer">
            Paid only
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            id="remote-only"
            checked={remoteOnly}
            onCheckedChange={onRemoteChange}
            aria-describedby="remote-only-desc"
          />
          <Label htmlFor="remote-only" className="text-sm cursor-pointer">
            Remote only
          </Label>
        </div>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
};

export default OpportunityFilters;
