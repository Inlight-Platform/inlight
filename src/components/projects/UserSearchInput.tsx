import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { X, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface UserSearchInputProps {
  value: Profile | null;
  onChange: (user: Profile | null) => void;
  placeholder?: string;
  excludeUserIds?: string[];
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search users...',
  excludeUserIds = [],
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch profiles based on search query
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profile-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, role')
        .ilike('display_name', `%${query}%`)
        .limit(10);
      
      if (error) throw error;
      return (data || []).filter(p => !excludeUserIds.includes(p.user_id)) as Profile[];
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
    onChange(profile);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 p-2 bg-accent/50 rounded-lg">
        <Avatar className="h-8 w-8">
          <AvatarImage src={value.avatar_url || undefined} />
          <AvatarFallback>{value.display_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.display_name || 'Unknown'}</p>
          {value.role && (
            <p className="text-xs text-muted-foreground truncate">{value.role}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-1 hover:bg-accent rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
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
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                  'w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left'
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile.display_name || 'Unknown'}</p>
                  {profile.role && (
                    <p className="text-xs text-muted-foreground truncate">{profile.role}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
