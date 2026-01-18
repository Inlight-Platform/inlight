import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Download, Search, X, Award } from 'lucide-react';

interface NetworkProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  location: string | null;
  vouch_count: number;
}

const NetworkPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firstDegree } = useNetworkConnections();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'vouches'>('vouches');

  // Fetch profiles for 1st degree connections from database
  const { data: connectionProfiles = [], isLoading } = useQuery({
    queryKey: ['network-profiles', firstDegree],
    queryFn: async () => {
      if (firstDegree.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, role, location, vouch_count')
        .in('user_id', firstDegree);
      if (error) throw error;
      return data as NetworkProfile[];
    },
    enabled: firstDegree.length > 0,
  });

  const filteredConnections = useMemo(() => {
    let filtered = connectionProfiles.filter((profile) =>
      (profile.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profile.location || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
        break;
      case 'vouches':
        filtered.sort((a, b) => b.vouch_count - a.vouch_count);
        break;
      case 'recent':
      default:
        // Keep original order
        break;
    }
    
    return filtered;
  }, [connectionProfiles, searchQuery, sortBy]);

  const handleExportCSV = () => {
    const date = new Date().toISOString().split('T')[0];
    const headers = ['Name', 'Role', 'Location', 'Vouches'];
    const rows = filteredConnections.map((profile) => [
      profile.display_name || '',
      profile.role || '',
      profile.location || '',
      profile.vouch_count.toString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `My-Network-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleBlock = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real app, this would call an API
    console.log('Blocking user:', userId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-full hover:bg-accent transition-colors"
                aria-label="Go home"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-display font-bold">My Network</h1>
              <span className="text-muted-foreground">
                {filteredConnections.length} connection{filteredConnections.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportCSV}
              className="hidden sm:flex"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
          
          {/* Search and filters */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="vouches">Most Vouched</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConnections.map((profile) => (
              <div
                key={profile.user_id}
                onClick={() => handleUserClick(profile.user_id)}
                className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-card transition-all cursor-pointer group"
              >
                <img
                  src={profile.avatar_url || '/placeholder.svg'}
                  alt={profile.display_name || 'User'}
                  className="w-12 h-12 rounded-full object-cover"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{profile.display_name || 'Unknown'}</h3>
                    {profile.vouch_count > 0 && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Award className="w-3 h-3" />
                        <span className="text-xs font-medium">{profile.vouch_count}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {profile.role || 'No role'} • {profile.location || 'No location'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/messages');
                    }}
                    className="text-neon-messages"
                  >
                    Message
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleBlock(profile.user_id, e)}
                    className="text-destructive"
                  >
                    Block
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {filteredConnections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'No connections match your search.' 
                : 'No connections yet. Start networking!'}
            </p>
          </div>
        )}
        
        {/* Mobile export button */}
        <div className="fixed bottom-6 right-6 sm:hidden">
          <Button
            onClick={handleExportCSV}
            className="rounded-full w-14 h-14 shadow-lg"
          >
            <Download className="w-6 h-6" />
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NetworkPage;
