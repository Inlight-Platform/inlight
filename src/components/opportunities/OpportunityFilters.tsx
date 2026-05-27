import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OpportunityType, ExperienceLevel, UserRole } from '@/store/useStore';

interface OpportunityFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedType: OpportunityType | 'all';
  onTypeChange: (value: OpportunityType | 'all') => void;
  selectedRole: UserRole | 'all';
  onRoleChange: (value: UserRole | 'all') => void;
  selectedExperience: ExperienceLevel | 'all';
  onExperienceChange: (value: ExperienceLevel | 'all') => void;
  remoteOnly: boolean;
  onRemoteOnlyChange: (value: boolean) => void;
  locations: string[];
  selectedLocation: string;
  onLocationChange: (value: string) => void;
}

const opportunityTypes: { value: OpportunityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'job', label: 'Jobs' },
  { value: 'casting', label: 'Casting Calls' },
  { value: 'gig', label: 'Gigs' },
  { value: 'collaboration', label: 'Collaborations' },
];

const experienceLevels: { value: ExperienceLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'senior', label: 'Senior' },
  { value: 'any', label: 'Any Level' },
];

const roles: { value: UserRole | 'all'; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'Actor', label: 'Actor' },
  { value: 'Director', label: 'Director' },
  { value: 'Producer', label: 'Producer' },
  { value: 'Musician', label: 'Musician' },
  { value: 'Gaffer', label: 'Gaffer' },
  { value: 'Grip', label: 'Grip' },
  { value: 'DP', label: 'DP' },
  { value: 'AD', label: 'AD' },
  { value: 'Extras', label: 'Extras' },
  { value: 'Singer', label: 'Singer' },
  { value: 'Dancer', label: 'Dancer' },
  { value: 'Designer', label: 'Designer' },
];

const OpportunityFilters: React.FC<OpportunityFiltersProps> = ({
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedRole,
  onRoleChange,
  selectedExperience,
  onExperienceChange,
  remoteOnly,
  onRemoteOnlyChange,
  locations,
  selectedLocation,
  onLocationChange,
}) => {
  const hasActiveFilters = selectedType !== 'all' || selectedRole !== 'all' || 
    selectedExperience !== 'all' || remoteOnly || selectedLocation !== 'all';

  const clearFilters = () => {
    onTypeChange('all');
    onRoleChange('all');
    onExperienceChange('all');
    onRemoteOnlyChange(false);
    onLocationChange('all');
    onSearchChange('');
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search opportunities..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex flex-wrap gap-3">
        <Select value={selectedType} onValueChange={(v) => onTypeChange(v as OpportunityType | 'all')}>
          <SelectTrigger className="w-[140px] bg-card">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {opportunityTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedRole} onValueChange={(v) => onRoleChange(v as UserRole | 'all')}>
          <SelectTrigger className="w-[140px] bg-card">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {roles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedExperience} onValueChange={(v) => onExperienceChange(v as ExperienceLevel | 'all')}>
          <SelectTrigger className="w-[150px] bg-card">
            <SelectValue placeholder="Experience" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {experienceLevels.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedLocation} onValueChange={onLocationChange}>
          <SelectTrigger className="w-[160px] bg-card">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={remoteOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onRemoteOnlyChange(!remoteOnly)}
          className={remoteOnly ? 'bg-[hsl(var(--neon-opportunities))] text-foreground' : ''}
        >
          Remote Only
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

export default OpportunityFilters;
