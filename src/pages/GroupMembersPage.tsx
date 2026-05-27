import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Users, GraduationCap, UserCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface GroupMember {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  badges: string[] | null;
  graduation_status: string | null;
  graduation_year: number | null;
}

const GroupMembersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const badgeTag = searchParams.get('badge') || '';
  const [activeTab, setActiveTab] = useState('all');
  
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
  
  // Fetch members with this badge (badges are stored without # prefix)
  const { data: members = [], isLoading: membersLoading } = useQuery<GroupMember[]>({
    queryKey: ['group-members', badgeTag],
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, user_id, display_name, avatar_url, role, badges, graduation_status, graduation_year')
        .contains('badges', [badgeTag.toLowerCase()]);
      if (error) throw error;
      return (data || []) as unknown as GroupMember[];
    },
    enabled: !!badgeTag,
  });

  // Filter members by graduation status
  const studentMembers = useMemo(() => 
    members.filter(m => m.graduation_status === 'student'), 
    [members]
  );
  
  const alumniMembers = useMemo(() => 
    members.filter(m => m.graduation_status === 'alumni'), 
    [members]
  );

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const renderMemberCard = (user: GroupMember) => (
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
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold truncate">
              {user.display_name || 'Unknown User'}
            </h3>
            {user.graduation_status && user.graduation_year && (
              <Badge variant="outline" className="text-xs gap-1 flex-shrink-0">
                <GraduationCap className="w-3 h-3" />
                '{user.graduation_year.toString().slice(-2)}
              </Badge>
            )}
          </div>
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
  );

  if (!badgeTag) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No group specified</p>
      </div>
    );
  }

  return (
    <div className="w-full">
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
        {/* Tabs for All / Students / Alumni */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 mx-auto flex justify-center">
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              All ({members.length})
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              Students ({studentMembers.length})
            </TabsTrigger>
            <TabsTrigger value="alumni" className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              Alumni ({alumniMembers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {membersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : members.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map(renderMemberCard)}
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
          </TabsContent>

          <TabsContent value="students">
            {membersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : studentMembers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {studentMembers.map(renderMemberCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No students yet</h3>
                <p className="text-muted-foreground">
                  No current students have the #{badgeTag} badge.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="alumni">
            {membersLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : alumniMembers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {alumniMembers.map(renderMemberCard)}
              </div>
            ) : (
              <div className="text-center py-12">
                <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No alumni yet</h3>
                <p className="text-muted-foreground">
                  No alumni have the #{badgeTag} badge.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GroupMembersPage;
