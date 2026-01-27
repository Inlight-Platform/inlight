import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { X, Search, Loader2, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

export interface Teammate {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role_description?: string;
}

interface TeammateSelectorProps {
  teammates: Teammate[];
  onChange: (teammates: Teammate[]) => void;
  placeholder?: string;
  excludeUserIds?: string[];
  maxTeammates?: number;
}

export const TeammateSelector: React.FC<TeammateSelectorProps> = ({
  teammates,
  onChange,
  placeholder = 'Search to add teammates...',
  excludeUserIds = [],
  maxTeammates = 20,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get all excluded IDs (props + already selected)
  const allExcludedIds = [...excludeUserIds, ...teammates.map(t => t.user_id)];

  // Fetch profiles based on search query
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profile-search-teammates', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, role')
        .ilike('display_name', `%${query}%`)
        .limit(10);
      
      if (error) throw error;
      return (data || []).filter(p => p.user_id && !allExcludedIds.includes(p.user_id)) as Profile[];
    },
    enabled: query.length >= 2,
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (profile: Profile) => {
    if (teammates.length >= maxTeammates) return;
    onChange([...teammates, { 
      user_id: profile.user_id, 
      display_name: profile.display_name, 
      avatar_url: profile.avatar_url 
    }]);
    setQuery('');
    setIsOpen(false);
  };

  const handleRemove = (userId: string) => {
    onChange(teammates.filter(t => t.user_id !== userId));
  };

  return (
    <div className="space-y-3">
      {/* Selected teammates */}
      {teammates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teammates.map((teammate) => (
            <Badge 
              key={teammate.user_id} 
              variant="secondary"
              className="pl-1 pr-2 py-1 flex items-center gap-1.5"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={teammate.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {teammate.display_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{teammate.display_name || 'Unknown'}</span>
              <button
                type="button"
                onClick={() => handleRemove(teammate.user_id)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input */}
      {teammates.length < maxTeammates && (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="pl-10"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {isOpen && query.length >= 2 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {profiles.length === 0 && !isLoading ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  No users found
                </div>
              ) : (
                profiles.map((profile) => (
                  <button
                    key={profile.user_id}
                    type="button"
                    onClick={() => handleSelect(profile)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 hover:bg-accent transition-colors text-left'
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {profile.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profile.display_name || 'Unknown'}</p>
                      {profile.role && (
                        <p className="text-xs text-muted-foreground truncate">{profile.role}</p>
                      )}
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {teammates.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Add cast and crew members working on this show
        </p>
      )}
    </div>
  );
};

export default TeammateSelector;
