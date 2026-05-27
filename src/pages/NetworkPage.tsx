import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Download, Search, X, Award, Users, Inbox, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const { 
    pendingRequests, 
    sentRequests, 
    acceptRequest, 
    rejectRequest, 
    cancelRequest,
    isLoading: requestsLoading 
  } = useConnectionRequests();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'vouches'>('vouches');
  const [activeTab, setActiveTab] = useState('connections');

  // Fetch profiles for 1st degree connections from database
  const { data: connectionProfiles = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['network-profiles', firstDegree],
    queryFn: async () => {
      if (firstDegree.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, role, location, vouch_count')
        .in('user_id', firstDegree);
      if (error) throw error;
      return data as NetworkProfile[];
    },
    enabled: firstDegree.length > 0,
  });

  // Fetch profiles for pending request senders
  const pendingSenderIds = pendingRequests.map(r => r.sender_id);
  const { data: pendingProfiles = [] } = useQuery({
    queryKey: ['pending-request-profiles', pendingSenderIds],
    queryFn: async () => {
      if (pendingSenderIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, role, location, vouch_count')
        .in('user_id', pendingSenderIds);
      if (error) throw error;
      return data as NetworkProfile[];
    },
    enabled: pendingSenderIds.length > 0,
  });

  // Fetch profiles for sent request receivers
  const sentReceiverIds = sentRequests.filter(r => r.status === 'pending').map(r => r.receiver_id);
  const { data: sentProfiles = [] } = useQuery({
    queryKey: ['sent-request-profiles', sentReceiverIds],
    queryFn: async () => {
      if (sentReceiverIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url, role, location, vouch_count')
        .in('user_id', sentReceiverIds);
      if (error) throw error;
      return data as NetworkProfile[];
    },
    enabled: sentReceiverIds.length > 0,
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
    link.download = `My-Community-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleAcceptRequest = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await acceptRequest.mutateAsync(requestId);
      toast.success('Connection request accepted!');
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await rejectRequest.mutateAsync(requestId);
      toast.success('Connection request declined');
    } catch (error) {
      toast.error('Failed to decline request');
    }
  };

  const handleCancelRequest = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelRequest.mutateAsync(requestId);
      toast.success('Request cancelled');
    } catch (error) {
      toast.error('Failed to cancel request');
    }
  };

  const pendingCount = pendingRequests.length;
  const sentPendingCount = sentRequests.filter(r => r.status === 'pending').length;

  const renderProfileCard = (
    profile: NetworkProfile, 
    actions?: React.ReactNode
  ) => (
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
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => safeBack(navigate, '/feed')}
                className="p-2 rounded-full hover:bg-accent transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-display font-bold">My Community</h1>
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
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mx-auto flex justify-center mb-4">
              <TabsTrigger value="connections" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Connections
                <span className="text-xs text-muted-foreground">({firstDegree.length})</span>
              </TabsTrigger>
              <TabsTrigger value="incoming" className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Incoming
                {pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Sent
                {sentPendingCount > 0 && (
                  <span className="text-xs text-muted-foreground">({sentPendingCount})</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Search and filters - only for connections tab */}
            {activeTab === 'connections' && (
              <div className="flex gap-3 justify-center">
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
            )}
          </Tabs>
        </div>
      </header>
      
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Connections Tab */}
        {activeTab === 'connections' && (
          <>
            {connectionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredConnections.map((profile) =>
                  renderProfileCard(profile, (
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
                    </div>
                  ))
                )}
              </div>
            )}
            
            {filteredConnections.length === 0 && !connectionsLoading && (
              <div className="text-center py-16">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? 'No connections match your search.' 
                    : 'No connections yet. Start networking!'}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/people')}
                >
                  Discover People
                </Button>
              </div>
            )}
          </>
        )}

        {/* Incoming Requests Tab */}
        {activeTab === 'incoming' && (
          <>
            {requestsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((request) => {
                  const profile = pendingProfiles.find(p => p.user_id === request.sender_id);
                  if (!profile) return null;
                  
                  return renderProfileCard(profile, (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => handleAcceptRequest(request.id, e)}
                        disabled={acceptRequest.isPending}
                      >
                        {acceptRequest.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Accept'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleRejectRequest(request.id, e)}
                        disabled={rejectRequest.isPending}
                      >
                        Decline
                      </Button>
                    </div>
                  ));
                })}
              </div>
            )}
            
            {pendingRequests.length === 0 && !requestsLoading && (
              <div className="text-center py-16">
                <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No pending connection requests
                </p>
              </div>
            )}
          </>
        )}

        {/* Sent Requests Tab */}
        {activeTab === 'sent' && (
          <>
            {requestsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {sentRequests
                  .filter(r => r.status === 'pending')
                  .map((request) => {
                    const profile = sentProfiles.find(p => p.user_id === request.receiver_id);
                    if (!profile) return null;
                    
                    return renderProfileCard(profile, (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Pending</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleCancelRequest(request.id, e)}
                          disabled={cancelRequest.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    ));
                  })}
              </div>
            )}
            
            {sentRequests.filter(r => r.status === 'pending').length === 0 && !requestsLoading && (
              <div className="text-center py-16">
                <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No pending sent requests
                </p>
              </div>
            )}
          </>
        )}
        
        {/* Mobile export button */}
        {activeTab === 'connections' && (
          <div className="fixed bottom-6 right-6 sm:hidden">
            <Button
              onClick={handleExportCSV}
              className="rounded-full w-14 h-14 shadow-lg"
            >
              <Download className="w-6 h-6" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default NetworkPage;
