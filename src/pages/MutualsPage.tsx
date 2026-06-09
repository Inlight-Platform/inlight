import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Search, Compass, Users, UserPlus, UserCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';

const MutualsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUserId = useStore((s) => s.currentUserId);
  const get1stDegree = useStore((s) => s.get1stDegree);
  const get2ndDegree = useStore((s) => s.get2ndDegree);
  const get3rdDegree = useStore((s) => s.get3rdDegree);
  const getMutualCount = useStore((s) => s.getMutualCount);
  const getConnectionStatus = useStore((s) => s.getConnectionStatus);
  const sendConnectionRequest = useStore((s) => s.sendConnectionRequest);
  
  const { following, followers } = useNetworkConnections();
  
  const [activeTab, setActiveTab] = useState('explore');
  const [searchQuery, setSearchQuery] = useState('');
  
  const firstDegree = useMemo(() => get1stDegree(currentUserId), [currentUserId, get1stDegree]);
  const secondDegree = useMemo(() => get2ndDegree(currentUserId), [currentUserId, get2ndDegree]);
  const thirdDegree = useMemo(() => get3rdDegree(currentUserId), [currentUserId, get3rdDegree]);
  
  // Fetch all users from the database
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
  
  // Get profiles for following users
  const { data: followingProfiles = [] } = useQuery({
    queryKey: ['following-profiles', following],
    queryFn: async () => {
      if (following.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .in('user_id', following);
      if (error) throw error;
      return data || [];
    },
    enabled: following.length > 0,
  });
  
  // Get profiles for followers
  const { data: followerProfiles = [] } = useQuery({
    queryKey: ['follower-profiles', followers],
    queryFn: async () => {
      if (followers.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .in('user_id', followers);
      if (error) throw error;
      return data || [];
    },
    enabled: followers.length > 0,
  });
  
  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    
    const query = searchQuery.toLowerCase();
    return allUsers.filter((user) => {
      const nameMatch = user.display_name?.toLowerCase().includes(query);
      const roleMatch = user.role?.toLowerCase().includes(query);
      const badgesMatch = user.badges?.some((badge: string) => 
        badge.toLowerCase().includes(query)
      );
      return nameMatch || roleMatch || badgesMatch;
    });
  }, [allUsers, searchQuery]);
  
  const handleConnect = (userId: string) => {
    sendConnectionRequest(userId);
  };
  
  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };
  
  const renderUserCard = (user: ReturnType<typeof get1stDegree>[0], degree: number) => {
    const connectionStatus = getConnectionStatus(user.id);
    const mutualCount = getMutualCount(user.id);
    
    return (
      <div
        key={user.id}
        className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow"
      >
        <div 
          className="cursor-pointer"
          onClick={() => handleUserClick(user.id)}
        >
          <div className="flex items-center gap-4 p-4">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover"
              />
              <span className={`absolute -bottom-1 -right-1 degree-badge degree-${degree}`}>
                {degree}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold truncate">{user.name}</h3>
              <p className="text-muted-foreground text-sm truncate">{user.role}</p>
              {mutualCount > 0 && degree !== 1 && (
                <p className="text-sm text-muted-foreground">
                  {mutualCount} mutual connection{mutualCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {degree !== 1 && (
          <div className="px-4 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleConnect(user.id);
              }}
              disabled={connectionStatus === 'pending'}
              className={`w-full h-9 rounded-full font-medium text-sm transition-all ${
                connectionStatus === 'pending'
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {connectionStatus === 'pending' ? 'Pending' : 'Connect'}
            </button>
          </div>
        )}
        
        {degree === 1 && (
          <div className="px-4 pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/messages');
              }}
              className="w-full h-9 rounded-full font-medium text-sm bg-gradient-to-r from-[hsl(264,100%,71%)] to-[hsl(280,100%,65%)] text-white hover:opacity-90 transition-all"
            >
              Message
            </button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label="Go home"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-display font-bold">People</h1>
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 mb-6">
              <TabsTrigger value="explore" className="data-[state=active]:bg-primary/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Compass className="w-4 h-4" />
                Explore
              </TabsTrigger>
              <TabsTrigger value="mutuals" className="data-[state=active]:bg-neon-mutuals/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">My Network</span> ({firstDegree.length})
              </TabsTrigger>
              <TabsTrigger value="following" className="data-[state=active]:bg-neon-messages/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Following</span> ({following.length})
              </TabsTrigger>
              <TabsTrigger value="followers" className="data-[state=active]:bg-neon-insights/20 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Followers</span> ({followers.length})
              </TabsTrigger>
              <TabsTrigger value="2nd" className="data-[state=active]:bg-neon-messages/20 flex-shrink-0 whitespace-nowrap">
                2nd ({secondDegree.length})
              </TabsTrigger>
              <TabsTrigger value="3rd" className="data-[state=active]:bg-neon-insights/20 flex-shrink-0 whitespace-nowrap">
                3rd ({thirdDegree.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-accent/20 flex-shrink-0 whitespace-nowrap">
                All ({allUsers.length})
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="explore">
            <div className="mb-6">
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, role, or badge..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading users...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => user.user_id && navigate(`/profile/${user.user_id}`)}
                    >
                      <div className="flex items-center gap-4 p-4">
                        <img
                          src={user.avatar_url || '/placeholder.svg'}
                          alt={user.display_name || 'User'}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold truncate">
                            {user.display_name || 'Unknown User'}
                          </h3>
                          <p className="text-muted-foreground text-sm truncate">{user.role || 'No role'}</p>
                          {user.badges && user.badges.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {user.badges.slice(0, 2).map((badge: string, idx: number) => (
                                <span 
                                  key={idx} 
                                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                                >
                                  {badge}
                                </span>
                              ))}
                              {user.badges.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{user.badges.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No users found matching your search.' : 'No users yet.'}
                  </p>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="all">
            <div className="mb-6">
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, role, or badge..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading users...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => user.user_id && navigate(`/profile/${user.user_id}`)}
                    >
                      <div className="flex items-center gap-4 p-4">
                        <img
                          src={user.avatar_url || '/placeholder.svg'}
                          alt={user.display_name || 'User'}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold truncate">
                            {user.display_name || 'Unknown User'}
                          </h3>
                          <p className="text-muted-foreground text-sm truncate">{user.role || 'No role'}</p>
                          {user.badges && user.badges.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {user.badges.slice(0, 2).map((badge: string, idx: number) => (
                                <span 
                                  key={idx} 
                                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                                >
                                  {badge}
                                </span>
                              ))}
                              {user.badges.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{user.badges.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredUsers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No users found matching your search.' : 'No users yet.'}
                  </p>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="mutuals">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {firstDegree.map((user) => renderUserCard(user, 1))}
            </div>
            {firstDegree.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No mutual connections yet. Start connecting with others!
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="following">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {followingProfiles.map((user) => (
                <div
                  key={user.id}
                  className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => user.user_id && navigate(`/profile/${user.user_id}`)}
                >
                  <div className="flex items-center gap-4 p-4">
                    <img
                      src={user.avatar_url || '/placeholder.svg'}
                      alt={user.display_name || 'User'}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold truncate">
                        {user.display_name || 'Unknown User'}
                      </h3>
                      <p className="text-muted-foreground text-sm truncate">{user.role || 'No role'}</p>
                      <span className="text-xs text-primary">Following</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {followingProfiles.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                You're not following anyone yet.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="followers">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {followerProfiles.map((user) => (
                <div
                  key={user.id}
                  className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => user.user_id && navigate(`/profile/${user.user_id}`)}
                >
                  <div className="flex items-center gap-4 p-4">
                    <img
                      src={user.avatar_url || '/placeholder.svg'}
                      alt={user.display_name || 'User'}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold truncate">
                        {user.display_name || 'Unknown User'}
                      </h3>
                      <p className="text-muted-foreground text-sm truncate">{user.role || 'No role'}</p>
                      <span className="text-xs text-muted-foreground">Follows you</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {followerProfiles.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No followers yet.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="2nd">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {secondDegree.map((user) => renderUserCard(user, 2))}
            </div>
            {secondDegree.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No 2nd-degree connections found.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="3rd">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {thirdDegree.map((user) => renderUserCard(user, 3))}
            </div>
            {thirdDegree.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No 3rd-degree connections found.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MutualsPage;
