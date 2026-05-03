import React, { useState, useMemo } from 'react';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Compass, Users, GraduationCap, Clock, Building2, ChevronDown, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import PersonCard from '@/components/people/PersonCard';
import CompanyCard from '@/components/people/CompanyCard';
import { useCompanyFollows } from '@/hooks/useCompanyFollows';

interface Studio {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge_tag: string | null;
}

const PREVIEW_COUNT = 6;

const GroupsSection: React.FC<{
  studios: Studio[];
  studiosLoading: boolean;
  onStudioClick: (tag: string | null) => void;
}> = ({ studios, studiosLoading, onStudioClick }) => {
  const [expanded, setExpanded] = useState(false);
  const hasMore = studios.length > PREVIEW_COUNT;
  const visibleStudios = expanded ? studios : studios.slice(0, PREVIEW_COUNT);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-display font-semibold">Explore by Groups</h2>
      </div>

      {studiosLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : studios.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {visibleStudios.map((studio) => (
              <Card
                key={studio.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors group"
                onClick={() => onStudioClick(studio.badge_tag)}
              >
                <CardContent className="p-4 text-center">
                  <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">
                    {studio.icon}
                  </span>
                  <h3 className="font-semibold text-xs mb-0.5 line-clamp-2">
                    {studio.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {studio.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 mx-auto mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{expanded ? 'Less' : 'More'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">No groups available yet.</p>
      )}
    </section>
  );
};

const PeoplePage: React.FC = () => {
  const navigate = useNavigate();
  const currentUserId = useStore((s) => s.currentUserId);
  
  const { isMutual, firstDegree } = useNetworkConnections();
  const { sentRequests, pendingRequests, cancelRequest, sendRequest, acceptRequest, rejectRequest } = useConnectionRequests();
  const { companies, companiesLoading, isFollowingCompany, followCompany, unfollowCompany } = useCompanyFollows();
  
  // Get pending sent requests
  const pendingSentRequests = useMemo(() => 
    sentRequests.filter(r => r.status === 'pending'), 
    [sentRequests]
  );
  
  // Get pending receiver IDs for quick lookup
  const pendingReceiverIds = useMemo(() => 
    new Set(pendingSentRequests.map(r => r.receiver_id)), 
    [pendingSentRequests]
  );
  
  const [activeTab, setActiveTab] = useState('explore');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch all users from the database
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, user_id, display_name, stage_name, avatar_url, cover_url, location, pronouns, role, badges, bio, headline, skills, instagram_url, website_url, graduation_status, graduation_year, created_at, updated_at, activity_score')
        .order('activity_score', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch studios for the "Groups" section
  const { data: studios = [], isLoading: studiosLoading } = useQuery({
    queryKey: ['studios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Studio[];
    },
  });
  
  // Get profiles for pending sent requests
  const pendingReceiverIdsList = useMemo(() => 
    pendingSentRequests.map(r => r.receiver_id), 
    [pendingSentRequests]
  );
  
  const { data: pendingProfiles = [] } = useQuery({
    queryKey: ['pending-request-profiles', pendingReceiverIdsList],
    queryFn: async () => {
      if (pendingReceiverIdsList.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .in('user_id', pendingReceiverIdsList);
      if (error) throw error;
      return data || [];
    },
    enabled: pendingReceiverIdsList.length > 0,
  });

  // Get profiles for incoming request senders
  const incomingSenderIds = useMemo(() => 
    pendingRequests.map(r => r.sender_id), 
    [pendingRequests]
  );
  
  const { data: incomingProfiles = [] } = useQuery({
    queryKey: ['incoming-request-profiles', incomingSenderIds],
    queryFn: async () => {
      if (incomingSenderIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .in('user_id', incomingSenderIds);
      if (error) throw error;
      return data || [];
    },
    enabled: incomingSenderIds.length > 0,
  });

  // Get profiles for 1st degree connections
  const { data: networkProfiles = [] } = useQuery({
    queryKey: ['network-profiles', firstDegree],
    queryFn: async () => {
      if (firstDegree.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .in('user_id', firstDegree);
      if (error) throw error;
      return data || [];
    },
    enabled: firstDegree.length > 0,
  });
  
  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    // Exclude current user
    const usersExcludingSelf = allUsers.filter(u => u.user_id !== currentUserId);
    
    if (!searchQuery.trim()) return usersExcludingSelf;
    
    const query = searchQuery.toLowerCase();
    return usersExcludingSelf.filter((user) => {
      const nameMatch = user.display_name?.toLowerCase().includes(query);
      const roleMatch = user.role?.toLowerCase().includes(query);
      const badgesMatch = user.badges?.some((badge: string) => 
        badge.toLowerCase().includes(query)
      );
      const skillsMatch = user.skills?.some((skill: string) => 
        skill.toLowerCase().includes(query)
      );
      return nameMatch || roleMatch || badgesMatch || skillsMatch;
    });
  }, [allUsers, searchQuery, currentUserId]);

  // Get connection status for a user
  const getConnectionStatus = (userId: string): 'none' | 'pending' | 'connected' => {
    if (isMutual(userId)) return 'connected';
    if (pendingReceiverIds.has(userId)) return 'pending';
    return 'none';
  };
  
  const handleConnect = (userId: string) => {
    // Prevent connecting with self
    if (userId === currentUserId) {
      return;
    }
    sendRequest.mutate(userId);
  };

  // Get pending request ID for a user
  const getPendingRequestId = (userId: string) => {
    const request = pendingSentRequests.find(r => r.receiver_id === userId);
    return request?.id;
  };

  const handleCancelRequest = (requestId: string) => {
    cancelRequest.mutate(requestId);
  };

  const handleStudioClick = (badgeTag: string | null) => {
    if (badgeTag) {
      navigate(`/group?badge=${badgeTag}`);
    }
  };

  const handleAcceptRequest = (requestId: string) => {
    acceptRequest.mutate(requestId);
  };

  const handleDeclineRequest = (requestId: string) => {
    rejectRequest.mutate(requestId);
  };

  const userCount = filteredUsers.length;
  
  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <img
              src={inlightLogo}
              alt="Inlight"
              className="w-10 h-10 rounded-full object-cover"
            />
            <h1 className="text-2xl font-display font-bold">People</h1>
          </div>
        </div>
      </header>
      
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Explore by Groups Section */}
        <GroupsSection studios={studios} studiosLoading={studiosLoading} onStudioClick={handleStudioClick} />

        {/* Tabs for Network */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 mb-6">
              <TabsTrigger value="explore" className="data-[state=active]:bg-primary/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Compass className="w-4 h-4" />
                Explore
              </TabsTrigger>
              <TabsTrigger value="network" className="data-[state=active]:bg-green-500/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Community</span> ({firstDegree.length})
              </TabsTrigger>
              <TabsTrigger value="incoming" className="data-[state=active]:bg-blue-500/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Inbox className="w-4 h-4" />
                <span className="hidden sm:inline">Incoming</span>
                {pendingRequests.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Sent</span> ({pendingSentRequests.length})
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="explore">
            {/* Search and Count Header */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-display font-semibold">Creators to Connect With</h2>
                  <p className="text-sm text-muted-foreground">{userCount} creators found</p>
                </div>
              </div>
              <div className="relative max-w-xl" data-tour="people-search">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, skills, or program..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base rounded-full border-2 focus-visible:ring-primary/20"
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden">
                    <Skeleton className="h-24 w-full" />
                    <div className="p-4 space-y-3">
                      <Skeleton className="h-20 w-20 rounded-full mx-auto -mt-12" />
                      <Skeleton className="h-5 w-32 mx-auto" />
                      <Skeleton className="h-4 w-24 mx-auto" />
                      <Skeleton className="h-10 w-full rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredUsers.map((user) => {
                    const userId = user.user_id || '';
                    const isOwnProfile = userId === currentUserId;
                    const status = getConnectionStatus(userId);
                    const pendingRequestId = status === 'pending' ? getPendingRequestId(userId) : undefined;
                    
                    return (
                      <PersonCard
                        key={user.id}
                        user={user}
                        connectionStatus={status}
                        showCancelButton={status === 'pending'}
                        requestId={pendingRequestId}
                        isOwnProfile={isOwnProfile}
                        onConnect={handleConnect}
                        onCancel={handleCancelRequest}
                        
                      />
                    );
                  })}
                </div>
                {filteredUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-12">
                    {searchQuery ? 'No creators found matching your search.' : 'No creators yet.'}
                  </p>
                )}
              </>
            )}

            {/* Companies Section */}
            {!searchQuery && (
              <section className="mt-12">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-display font-semibold">Companies to Connect With</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{companies.length} companies</p>
                {companiesLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                  </div>
                ) : companies.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map((company) => (
                      <CompanyCard
                        key={company.id}
                        company={company}
                        isFollowing={isFollowingCompany(company.id)}
                        onFollow={(id) => followCompany.mutate(id)}
                        onUnfollow={(id) => unfollowCompany.mutate(id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No companies yet.</p>
                )}
              </section>
            )}
          </TabsContent>
          
          <TabsContent value="network">
            <div className="mb-6">
              <h2 className="text-xl font-display font-semibold">Your Community</h2>
              <p className="text-sm text-muted-foreground">{networkProfiles.length} connections</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {networkProfiles.map((user) => (
                <PersonCard
                  key={user.id}
                  user={user}
                  connectionStatus="connected"
                  
                />
              ))}
            </div>
            {networkProfiles.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No mutual connections yet. Start connecting with others!
              </p>
            )}
          </TabsContent>

          <TabsContent value="incoming">
            <div className="mb-6">
              <h2 className="text-xl font-display font-semibold">Incoming Requests</h2>
              <p className="text-sm text-muted-foreground">{incomingProfiles.length} incoming</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {incomingProfiles.map((user) => {
                const request = pendingRequests.find(r => r.sender_id === user.user_id);
                return (
                  <PersonCard
                    key={user.id}
                    user={user}
                    showIncomingActions
                    requestId={request?.id}
                    onAccept={handleAcceptRequest}
                    onDecline={handleDeclineRequest}
                  />
                );
              })}
            </div>
            {incomingProfiles.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No incoming connection requests.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="pending">
            <div className="mb-6">
              <h2 className="text-xl font-display font-semibold">Sent Requests</h2>
              <p className="text-sm text-muted-foreground">{pendingProfiles.length} pending</p>
            </div>
            
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {pendingProfiles.map((user) => {
                const request = pendingSentRequests.find(r => r.receiver_id === user.user_id);
                return (
                  <PersonCard
                    key={user.id}
                    user={user}
                    showCancelButton
                    requestId={request?.id}
                    onCancel={(id) => cancelRequest.mutate(id)}
                  />
                );
              })}
            </div>
            {pendingProfiles.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No pending connection requests.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PeoplePage;
