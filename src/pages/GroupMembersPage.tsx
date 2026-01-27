import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import PageLayout from '@/components/layout/PageLayout';

const GroupMembersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const badgeTag = searchParams.get('badge') || '';
  
  // Fetch studio info
  const { data: studio, isLoading: studioLoading } = useQuery({
    queryKey: ['studio-by-badge', badgeTag],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studios')
        .select('*')
        .eq('badge_tag', badgeTag)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!badgeTag,
  });
  
  // Fetch members with this badge
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', badgeTag],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .contains('badges', [`#${badgeTag}`]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!badgeTag,
  });

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (!badgeTag) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No group specified</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/people')}
              className="p-2 rounded-full hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            {studioLoading ? (
              <Skeleton className="h-10 w-10 rounded-full" />
            ) : (
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, hsl(186 100% 50%), hsl(200 100% 60%))',
                  boxShadow: '0 0 20px hsl(186 100% 50% / 0.4)'
                }}
              >
                <span className="text-lg">{studio?.icon || '🎭'}</span>
              </div>
            )}
            <div>
              {studioLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h1 className="text-2xl font-display font-bold">{studio?.name || 'Group'}</h1>
              )}
              {studio?.description && (
                <p className="text-sm text-muted-foreground">{studio.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {membersLoading ? 'Loading...' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {membersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((user) => (
              <div
                key={user.id}
                className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => user.user_id && handleUserClick(user.user_id)}
              >
                <div className="flex items-center gap-4 p-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{user.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold truncate">
                      {user.display_name || 'Unknown User'}
                    </h3>
                    <p className="text-muted-foreground text-sm truncate">{user.role || 'No role'}</p>
                    {user.badges && user.badges.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {user.badges.slice(0, 3).map((badge: string, idx: number) => (
                          <span 
                            key={idx} 
                            className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                          >
                            {badge}
                          </span>
                        ))}
                        {user.badges.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{user.badges.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No members yet</h3>
            <p className="text-muted-foreground">
              No users have the #{badgeTag} badge yet.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default GroupMembersPage;
