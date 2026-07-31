import React, { useRef, useState } from 'react';
import { isPast } from 'date-fns';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, FolderKanban, Theater, Briefcase, BookOpen, ExternalLink, MessageSquare, Loader2, ChevronLeft, Film, User, Users } from 'lucide-react';
import { buildSharedItemMessage } from '@/components/messages/SharedItemCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSavedShows } from '@/hooks/useSavedShows';
import { useSavedFilms } from '@/hooks/useSavedFilms';
import { useSavedItems, SavedItem } from '@/hooks/useSavedItems';
import { useGroupChats } from '@/hooks/useGroupChats';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SavedProject {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  header_image_url?: string | null;
  category: string | null;
  creator_id: string;
  creator_profile?: { display_name: string | null; avatar_url: string | null };
}

interface SavedShow {
  id: string;
  title: string;
  venue: string;
  borough: string;
  category: string;
  show_type: string;
  poster_url: string | null;
  description: string | null;
  run_end: string | null;
  is_active: boolean;
}

const ShareDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  itemUrl?: string;
  itemType: string;
  imageUrl?: string;
}> = ({ open, onOpenChange, itemTitle, itemUrl, itemType, imageUrl }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const { groupChats } = useGroupChats();

  const { data: connections = [] } = useQuery({
    queryKey: ['share-connections', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: mutuals } = await supabase
        .rpc('get_mutual_connections', { target_user_id: user.id });
      if (!mutuals?.length) return [];
      const userIds = mutuals.map((m: { user_id: string }) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      return profiles || [];
    },
    enabled: !!user?.id && open,
  });

  const q = search.toLowerCase();
  const filteredConnections = connections.filter((c: any) =>
    !search || c.display_name?.toLowerCase().includes(q)
  );
  const filteredGroups = groupChats.filter(gc =>
    !search || gc.name?.toLowerCase().includes(q)
  );

  const buildMessage = () => buildSharedItemMessage({
    type: itemType,
    title: itemTitle,
    url: itemUrl,
    image_url: imageUrl,
  });

  const handleShare = async (receiverId: string, receiverName: string) => {
    if (!user?.id) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({ sender_id: user.id, receiver_id: receiverId, content: buildMessage() });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(`Shared with ${receiverName}!`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to share');
    } finally {
      setSending(false);
    }
  };

  const handleShareToGroup = async (groupChatId: string, groupName: string) => {
    if (!user?.id) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('group_chat_messages')
        .insert({ group_chat_id: groupChatId, sender_id: user.id, content: buildMessage() });
      if (error) throw error;
      await supabase
        .from('project_group_chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupChatId);
      // Notify all other group members
      const { data: members } = await supabase
        .from('group_chat_members')
        .select('user_id')
        .eq('group_chat_id', groupChatId)
        .neq('user_id', user.id);
      if (members?.length) {
        await supabase.from('notifications').insert(
          members.map(m => ({
            user_id: m.user_id,
            type: 'message',
            title: `New message in ${groupName}`,
            body: `Shared a ${itemType}`,
            data: { group_chat_id: groupChatId },
          }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['group-chats'] });
      toast.success(`Shared to ${groupName}!`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to share');
    } finally {
      setSending(false);
    }
  };

  const hasResults = filteredConnections.length > 0 || filteredGroups.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{itemTitle}"</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search connections or group chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="max-h-60 overflow-y-auto space-y-1">
          {!hasResults ? (
            <p className="text-sm text-muted-foreground text-center py-4">No connections or group chats found</p>
          ) : (
            <>
              {filteredConnections.length > 0 && (
                <>
                  {filteredGroups.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground px-2 pb-1">People</p>
                  )}
                  {filteredConnections.map((c: any) => (
                    <button
                      key={c.user_id}
                      onClick={() => handleShare(c.user_id, c.display_name || 'User')}
                      disabled={sending}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback>{c.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{c.display_name || 'Unknown'}</span>
                    </button>
                  ))}
                </>
              )}
              {filteredGroups.length > 0 && (
                <>
                  {filteredConnections.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground px-2 pt-2 pb-1">Group Chats</p>
                  )}
                  {filteredGroups.map((gc) => (
                    <button
                      key={gc.id}
                      onClick={() => handleShareToGroup(gc.id, gc.name)}
                      disabled={sending}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{gc.name}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MySavesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { savedShowIds, unsaveShow } = useSavedShows();
  const { savedFilmIds, unsaveFilm } = useSavedFilms();
  const { savedItems, unsaveItem } = useSavedItems();

  const [shareDialog, setShareDialog] = useState<{
    open: boolean;
    title: string;
    url?: string;
    type: string;
    imageUrl?: string;
  }>({ open: false, title: '', type: '' });

  const [showsFilter, setShowsFilter] = useState<'active' | 'history'>('active');
  const [filmsFilter, setFilmsFilter] = useState<'active' | 'history'>('active');
  const [jobsFilter, setJobsFilter] = useState<'active' | 'expired'>('active');

  // Fetch saved projects
  const { data: savedProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['my-saves-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: saved } = await supabase
        .from('saved_projects')
        .select('project_id')
        .eq('user_id', user.id);
      if (!saved?.length) return [];
      const projectIds = saved.map(s => s.project_id);
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);
      
      const creatorIds = [...new Set(projects?.map(p => p.creator_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', creatorIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return projects?.map(p => ({
        ...p,
        creator_profile: profileMap.get(p.creator_id),
      })) as SavedProject[] || [];
    },
    enabled: !!user?.id,
  });

  // Fetch saved shows
  const { data: savedShows = [], isLoading: loadingShows } = useQuery({
    queryKey: ['my-saved-shows', user?.id, savedShowIds],
    queryFn: async () => {
      if (!savedShowIds.length) return [];
      const { data } = await supabase
        .from('nyc_shows')
        .select('id, title, venue, borough, category, show_type, poster_url, description, run_end, is_active')
        .in('id', savedShowIds);
      return (data || []) as SavedShow[];
    },
    enabled: savedShowIds.length > 0,
    placeholderData: keepPreviousData,
  });

  // Fetch saved films
  const { data: savedFilms = [], isLoading: loadingFilms } = useQuery({
    queryKey: ['my-saved-films', user?.id, savedFilmIds],
    queryFn: async () => {
      if (!savedFilmIds.length) return [];
      const { data } = await supabase
        .from('film_metrics')
        .select('id, title, studio, poster_url, rating, weekend_gross, date')
        .in('id', savedFilmIds);
      return (data || []) as { id: string; title: string; studio: string; poster_url: string | null; rating: number; weekend_gross: number; date: string }[];
    },
    enabled: savedFilmIds.length > 0,
    placeholderData: keepPreviousData,
  });

  // Filter saved items by type
  const savedResources = savedItems.filter(i => i.item_type === 'resource');
  const savedJobs = savedItems.filter(i => i.item_type === 'job' || i.item_type === 'open_role');
  const savedPeople = savedItems.filter(i => i.item_type === 'person');

  // Live-fetch current deadline/status for saved jobs from the opportunities table
  const savedJobOpportunityIds = savedJobs.map(i => i.item_id).filter(Boolean) as string[];
  const savedJobTitles = savedJobs.filter(i => !i.item_id).map(i => i.item_title);
  const { data: liveOpportunityData = [] } = useQuery({
    queryKey: ['saved-jobs-live', savedJobOpportunityIds, savedJobTitles],
    queryFn: async () => {
      let query = supabase.from('opportunities').select('id, title, deadline, status');
      if (savedJobOpportunityIds.length && savedJobTitles.length) {
        query = query.or(`id.in.(${savedJobOpportunityIds.join(',')}),title.in.(${savedJobTitles.map(t => `"${t}"`).join(',')})`);
      } else if (savedJobOpportunityIds.length) {
        query = query.in('id', savedJobOpportunityIds);
      } else if (savedJobTitles.length) {
        query = query.in('title', savedJobTitles);
      } else {
        return [];
      }
      const { data } = await query;
      return data || [];
    },
    enabled: savedJobs.length > 0,
  });

  // Build lookup maps: id → live data, title → live data
  const liveById = new Map(liveOpportunityData.map((o: any) => [o.id, o]));
  const liveByTitle = new Map(liveOpportunityData.map((o: any) => [o.title, o]));

  const getJobStatus = (item: SavedItem): { deadline: string | null; status: string | null } => {
    const live = (item.item_id ? liveById.get(item.item_id) : null) ?? liveByTitle.get(item.item_title);
    if (live) return { deadline: live.deadline, status: live.status };
    return {
      deadline: (item.item_metadata?.deadline as string | undefined) ?? null,
      status: (item.item_metadata?.status as string | undefined) ?? null,
    };
  };

  const isJobExpired = (item: SavedItem) => {
    const { deadline, status } = getJobStatus(item);
    if (status === 'closed') return true;
    if (!deadline) return false;
    return isPast(new Date(deadline));
  };

  const activeJobs = savedJobs.filter(i => !isJobExpired(i));
  const expiredJobs = savedJobs.filter(i => isJobExpired(i));

  // Immediate filter — removes unsaved items before the network refetch settles
  const visibleShows = savedShows.filter(s => savedShowIds.includes(s.id));
  const visibleFilms = savedFilms.filter(f => savedFilmIds.includes(f.id));

  // Active/history splits for shows — mirrors Industry Now: active = no run_end or run_end not yet past
  const activeShows = visibleShows.filter(s => !s.run_end || !isPast(new Date(s.run_end)));
  const pastShows = visibleShows.filter(s => !!s.run_end && isPast(new Date(s.run_end)));

  // Active/history splits for films — mirrors Industry Now: older than 30 days = history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeFilms = visibleFilms.filter(f => new Date(f.date) >= thirtyDaysAgo);
  const pastFilms = visibleFilms.filter(f => new Date(f.date) < thirtyDaysAgo);

  const queryClient = useQueryClient();

  const unsaveProject = async (projectId: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('saved_projects')
      .delete()
      .eq('user_id', user.id)
      .eq('project_id', projectId);
    if (error) {
      toast.error('Could not remove project');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['my-saves-projects', user.id] });
    toast.success('Project removed from saves');
  };

  const isLoading = loadingProjects || loadingShows || loadingFilms;

  const totalSaves = savedProjects.length + visibleShows.length + visibleFilms.length + savedResources.length + savedJobs.length + savedPeople.length;
  const routeStateRef = useRef((location.state as { returnTo?: string } | null) || null);
  const routeState = routeStateRef.current;
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    initialTab && ['projects', 'shows', 'films', 'people', 'resources', 'jobs'].includes(initialTab)
      ? initialTab
      : 'projects'
  );
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === 'projects') params.delete('tab');
    else params.set('tab', tab);
    setSearchParams(params, { replace: true, state: routeState || undefined });
  };
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <p className="text-muted-foreground">Sign in to view your saves</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => {
              if (routeState?.returnTo) navigate(routeState.returnTo);
              else safeBack(navigate, '/feed', returnTo);
            }} className="p-1 rounded-full hover:bg-accent">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Bookmark className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-2xl font-display font-bold">My Saves</h1>
                <p className="text-sm text-muted-foreground">{totalSaves} saved items</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : totalSaves === 0 ? (
          <div className="text-center py-16">
            <Bookmark className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h2 className="text-xl font-semibold mb-2">No saves yet</h2>
            <p className="text-muted-foreground">Browse projects, shows, resources, and jobs to start saving!</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full max-w-3xl grid-cols-6 mx-auto">
              <TabsTrigger value="projects" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <FolderKanban className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span> ({savedProjects.length})
              </TabsTrigger>
              <TabsTrigger value="shows" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Theater className="w-4 h-4" />
                <span className="hidden sm:inline">Shows</span> ({visibleShows.length})
              </TabsTrigger>
              <TabsTrigger value="films" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Film className="w-4 h-4" />
                <span className="hidden sm:inline">Films</span> ({visibleFilms.length})
              </TabsTrigger>
              <TabsTrigger value="people" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">People</span> ({savedPeople.length})
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Resources</span> ({savedResources.length})
              </TabsTrigger>
              <TabsTrigger value="jobs" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">Jobs</span> ({savedJobs.length})
              </TabsTrigger>
            </TabsList>

            {/* Projects */}
            <TabsContent value="projects">
              {savedProjects.length === 0 ? (
                <EmptyCategory icon={FolderKanban} label="projects" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedProjects.map(project => (
                    <Card key={project.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/projects/${project.id}`)}>
                      {project.header_image_url || project.main_image_url ? (
                        <img src={project.header_image_url || project.main_image_url || undefined} alt={project.title} className="w-full h-36 object-cover" />
                      ) : (
                        <div className="w-full h-36 bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">No image</span>
                        </div>
                      )}
                      <CardContent className="p-4">
                        <h3 className="font-semibold truncate mb-1">{project.title}</h3>
                        {project.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{project.description}</p>}
                        <div className="flex items-center justify-between">
                          {project.category && <Badge variant="secondary" className="text-xs">{project.category}</Badge>}
                          <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setShareDialog({ open: true, title: project.title, url: `/projects/${project.id}`, type: 'Project', imageUrl: project.header_image_url || project.main_image_url || undefined }); }} className="p-1.5 rounded-full hover:bg-accent">
                              <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); unsaveProject(project.id); }} className="p-1.5 rounded-full hover:bg-accent">
                              <BookmarkCheck className="w-4 h-4 text-primary" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Shows */}
            <TabsContent value="shows">
              {visibleShows.length === 0 ? (
                <EmptyCategory icon={Theater} label="shows" />
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={showsFilter === 'active' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowsFilter('active')}
                    >
                      Now Playing ({activeShows.length})
                    </Button>
                    <Button
                      variant={showsFilter === 'history' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowsFilter('history')}
                    >
                      Closed ({pastShows.length})
                    </Button>
                  </div>
                  {(() => {
                    const shows = showsFilter === 'active' ? activeShows : pastShows;
                    return shows.length === 0 ? (
                      <div className="text-center py-12">
                        <Theater className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-muted-foreground">
                          {showsFilter === 'active' ? 'No currently running shows saved' : 'No closed shows saved'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shows.map(show => (
                          <Card
                            key={show.id}
                            className={cn("overflow-hidden hover:shadow-lg transition-shadow cursor-pointer", !!show.run_end && isPast(new Date(show.run_end)) && "opacity-60")}
                            onClick={() => navigate('/stage-whisper')}
                          >
                            {show.poster_url ? (
                              <img src={show.poster_url} alt={show.title} className="w-full h-36 object-cover" />
                            ) : (
                              <div className="w-full h-36 bg-muted flex items-center justify-center">
                                <Theater className="w-8 h-8 text-muted-foreground opacity-30" />
                              </div>
                            )}
                            <CardContent className="p-4">
                              <h3 className="font-semibold truncate mb-1">{show.title}</h3>
                              <p className="text-sm text-muted-foreground mb-2">{show.venue} • {show.borough}</p>
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs">{show.category}</Badge>
                                <div className="flex gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); setShareDialog({ open: true, title: show.title, type: 'Show', imageUrl: show.poster_url || undefined }); }} className="p-1.5 rounded-full hover:bg-accent">
                                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); unsaveShow(show.id); }} className="p-1.5 rounded-full hover:bg-accent">
                                    <BookmarkCheck className="w-4 h-4 text-primary" />
                                  </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </TabsContent>

            {/* Films */}
            <TabsContent value="films">
              {visibleFilms.length === 0 ? (
                <EmptyCategory icon={Film} label="films" />
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={filmsFilter === 'active' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilmsFilter('active')}
                    >
                      Active ({activeFilms.length})
                    </Button>
                    <Button
                      variant={filmsFilter === 'history' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilmsFilter('history')}
                    >
                      History ({pastFilms.length})
                    </Button>
                  </div>
                  {(() => {
                    const films = filmsFilter === 'active' ? activeFilms : pastFilms;
                    return films.length === 0 ? (
                      <div className="text-center py-12">
                        <Film className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-muted-foreground">
                          {filmsFilter === 'active' ? 'No films currently in theaters saved' : 'No past films saved'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {films.map(film => (
                          <Card
                            key={film.id}
                            className={cn("overflow-hidden hover:shadow-lg transition-shadow cursor-pointer", new Date(film.date) < thirtyDaysAgo && "opacity-60")}
                            onClick={() => navigate('/stage-whisper')}
                          >
                            {film.poster_url ? (
                              <img src={film.poster_url} alt={film.title} className="w-full h-36 object-cover" />
                            ) : (
                              <div className="w-full h-36 bg-muted flex items-center justify-center">
                                <Film className="w-8 h-8 text-muted-foreground opacity-30" />
                              </div>
                            )}
                            <CardContent className="p-4">
                              <h3 className="font-semibold truncate mb-1">{film.title}</h3>
                              <p className="text-sm text-muted-foreground mb-2">{film.studio}</p>
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs">⭐ {film.rating?.toFixed(1)}</Badge>
                                <div className="flex gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); setShareDialog({ open: true, title: film.title, type: 'Film', imageUrl: film.poster_url || undefined }); }} className="p-1.5 rounded-full hover:bg-accent">
                                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); unsaveFilm(film.id); }} className="p-1.5 rounded-full hover:bg-accent">
                                    <BookmarkCheck className="w-4 h-4 text-primary" />
                                  </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </TabsContent>

            {/* People */}
            <TabsContent value="people">
              {savedPeople.length === 0 ? (
                <EmptyCategory icon={User} label="people" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedPeople.map(item => {
                    const avatarUrl = item.item_metadata?.avatar_url as string | undefined;
                    const headline = item.item_metadata?.headline as string | undefined;
                    const location = item.item_metadata?.location as string | undefined;
                    return (
                      <Card
                        key={item.id}
                        className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => item.item_url && navigate(item.item_url, { state: { returnTo, returnState: routeState || undefined } })}
                      >
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={avatarUrl || undefined} />
                            <AvatarFallback>{item.item_title[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <h3 className="font-semibold truncate w-full">{item.item_title}</h3>
                          {headline && <p className="text-xs text-muted-foreground line-clamp-2">{headline}</p>}
                          {location && <p className="text-xs text-muted-foreground">{location}</p>}
                          <div className="flex items-center justify-end gap-1 w-full mt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setShareDialog({ open: true, title: item.item_title, url: item.item_url || undefined, type: 'Profile', imageUrl: avatarUrl }); }}
                              className="p-1.5 rounded-full hover:bg-accent"
                            >
                              <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); unsaveItem(item.id); }}
                              className="p-1.5 rounded-full hover:bg-accent"
                            >
                              <BookmarkCheck className="w-4 h-4 text-primary" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Resources */}
            <TabsContent value="resources">
              {savedResources.length === 0 ? (
                <EmptyCategory icon={BookOpen} label="resources" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedResources.map(item => (
                    <Card
                      key={item.id}
                      className={cn("hover:shadow-lg transition-shadow", item.item_url && "cursor-pointer")}
                      onClick={() => item.item_url && window.open(item.item_url, '_blank', 'noopener,noreferrer')}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold">{item.item_title}</h3>
                          {item.item_url && (
                            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        {item.item_metadata?.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.item_metadata.description}</p>
                        )}
                        {item.item_metadata?.category && (
                          <Badge variant="secondary" className="text-xs mb-2">{item.item_metadata.category}</Badge>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <button onClick={(e) => { e.stopPropagation(); setShareDialog({ open: true, title: item.item_title, url: item.item_url || undefined, type: 'Resource' }); }} className="p-1.5 rounded-full hover:bg-accent">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); unsaveItem(item.id); }} className="p-1.5 rounded-full hover:bg-accent">
                            <BookmarkCheck className="w-4 h-4 text-primary" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Jobs */}
            <TabsContent value="jobs">
              {savedJobs.length === 0 ? (
                <EmptyCategory icon={Briefcase} label="jobs" />
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={jobsFilter === 'active' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setJobsFilter('active')}
                    >
                      Active ({activeJobs.length})
                    </Button>
                    <Button
                      variant={jobsFilter === 'expired' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setJobsFilter('expired')}
                    >
                      Expired ({expiredJobs.length})
                    </Button>
                  </div>
                  {(() => {
                    const jobs = jobsFilter === 'active' ? activeJobs : expiredJobs;
                    return jobs.length === 0 ? (
                      <div className="text-center py-12">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-muted-foreground">
                          {jobsFilter === 'active' ? 'No active jobs saved' : 'No expired jobs saved'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {jobs.map(item => (
                          <Card
                            key={item.id}
                            className="hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => navigate('/opportunities')}
                          >
                            <CardContent className="p-4">
                              <h3 className="font-semibold mb-1">{item.item_title}</h3>
                              {item.item_metadata?.company && (
                                <p className="text-sm text-muted-foreground mb-1">{item.item_metadata.company}</p>
                              )}
                              {item.item_metadata?.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.item_metadata.description}</p>
                              )}
                              <div className="flex flex-wrap gap-1 mb-2">
                                {item.item_metadata?.type && <Badge variant="secondary" className="text-xs">{item.item_metadata.type}</Badge>}
                                {item.item_metadata?.location && <Badge variant="outline" className="text-xs">{item.item_metadata.location}</Badge>}
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={(e) => { e.stopPropagation(); setShareDialog({ open: true, title: item.item_title, type: 'Job' }); }} className="p-1.5 rounded-full hover:bg-accent">
                                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); unsaveItem(item.id); }} className="p-1.5 rounded-full hover:bg-accent">
                                  <BookmarkCheck className="w-4 h-4 text-primary" />
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <ShareDialog
        open={shareDialog.open}
        onOpenChange={(open) => setShareDialog(prev => ({ ...prev, open }))}
        itemTitle={shareDialog.title}
        itemUrl={shareDialog.url}
        itemType={shareDialog.type}
        imageUrl={shareDialog.imageUrl}
      />
    </div>
  );
};

const EmptyCategory: React.FC<{ icon: React.ComponentType<any>; label: string }> = ({ icon: Icon, label }) => (
  <div className="text-center py-12">
    <Icon className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
    <p className="text-muted-foreground">No saved {label} yet</p>
  </div>
);

export default MySavesPage;
