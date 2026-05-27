import React, { useState, useMemo } from 'react';
import inlightLogo from '@/assets/inlight-logo.jpeg';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Bookmark, BookmarkCheck, Filter, Search, X, ArrowUpDown, Users, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkConnections } from '@/hooks/useNetworkConnections';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProjectCreator, PROJECT_CATEGORIES, ProjectCategory } from '@/components/projects/ProjectCreator';
import { OpenRolesFeed } from '@/components/projects/OpenRolesFeed';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';

interface Project {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  header_image_url: string | null;
  creator_id: string;
  created_at: string;
  category: string | null;
  status: string | null;
  creator_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface SavedProject {
  id: string;
  project_id: string;
  project: Project;
}

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { firstDegree, secondDegree } = useNetworkConnections();
  const [showCreator, setShowCreator] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Fetch all projects with creator info
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch creator profiles
      const creatorIds = [...new Set(data.map(p => p.creator_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(project => ({
        ...project,
        creator_profile: profileMap.get(project.creator_id)
      })) as Project[];
    },
  });

  // Fetch saved projects
  const { data: savedProjects = [] } = useQuery({
    queryKey: ['saved-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('saved_projects')
        .select('id, project_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch saved projects with details for saved tab
  const { data: savedProjectDetails = [] } = useQuery({
    queryKey: ['saved-projects-details', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: saved, error } = await supabase
        .from('saved_projects')
        .select('id, project_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      if (!saved.length) return [];

      const projectIds = saved.map(s => s.project_id);
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);

      // Fetch creator profiles
      const creatorIds = [...new Set(projectsData?.map(p => p.creator_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return projectsData?.map(project => ({
        ...project,
        creator_profile: profileMap.get(project.creator_id)
      })) || [];
    },
    enabled: !!user?.id,
  });

  const savedProjectIds = new Set(savedProjects.map(s => s.project_id));

  // Filter projects by category and search query
  const filterBySearch = (projectList: Project[]) => {
    if (!searchQuery.trim()) return projectList;
    const query = searchQuery.toLowerCase().trim();
    return projectList.filter(p => 
      p.title.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  };

  // Sort projects
  const sortProjects = (projectList: Project[]) => {
    return [...projectList].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'a-z':
          return a.title.localeCompare(b.title);
        case 'z-a':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
  };

  // Helper to normalize status
  const normalizeStatus = (s: string | null): string => {
    const statusMap: Record<string, string> = {
      'pre-production': 'planning',
      'in-production': 'active',
      'post-production': 'wrapping',
      'completed': 'archived',
    };
    return statusMap[s?.toLowerCase() || ''] || s || 'planning';
  };

  // Filter out archived projects from main feed
  const activeProjects = projects.filter(p => normalizeStatus(p.status) !== 'archived');
  const archivedProjects = projects.filter(p => normalizeStatus(p.status) === 'archived');

  const filteredProjects = sortProjects(filterBySearch(
    selectedCategory === 'all' 
      ? activeProjects 
      : activeProjects.filter(p => p.category === selectedCategory)
  ));

  const filteredArchivedProjects = sortProjects(filterBySearch(
    selectedCategory === 'all'
      ? archivedProjects
      : archivedProjects.filter(p => p.category === selectedCategory)
  ));

  const filteredSavedProjects = sortProjects(filterBySearch(
    selectedCategory === 'all'
      ? savedProjectDetails
      : savedProjectDetails.filter(p => p.category === selectedCategory)
  ));

  // Filter projects by network (1st and 2nd degree connections)
  const networkUserIds = useMemo(() => {
    const ids = new Set<string>();
    firstDegree.forEach(id => ids.add(id));
    secondDegree.forEach(id => ids.add(id));
    if (user?.id) ids.add(user.id); // Include own projects
    return ids;
  }, [firstDegree, secondDegree, user?.id]);

  const networkProjects = useMemo(() => {
    return sortProjects(filterBySearch(
      activeProjects.filter(p => networkUserIds.has(p.creator_id))
        .filter(p => selectedCategory === 'all' || p.category === selectedCategory)
    ));
  }, [activeProjects, networkUserIds, selectedCategory, searchQuery, sortBy]);

  // Save project mutation
  const saveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_projects')
        .insert({ user_id: user.id, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-projects'] });
      queryClient.invalidateQueries({ queryKey: ['saved-projects-details'] });
      toast.success('Project saved!');
    },
    onError: () => toast.error('Failed to save project'),
  });

  // Unsave project mutation
  const unsaveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('saved_projects')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-projects'] });
      queryClient.invalidateQueries({ queryKey: ['saved-projects-details'] });
      toast.success('Project removed from saved');
    },
    onError: () => toast.error('Failed to remove project'),
  });

  const handleToggleSave = (projectId: string) => {
    if (savedProjectIds.has(projectId)) {
      unsaveProjectMutation.mutate(projectId);
    } else {
      saveProjectMutation.mutate(projectId);
    }
  };

  const getCategoryLabel = (category: string | null) => {
    return PROJECT_CATEGORIES.find(c => c.value === category)?.label || 'Other';
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const isSaved = savedProjectIds.has(project.id);

    return (
      <Card 
        className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-card border-border"
        onClick={() => navigate(`/projects/${project.id}`)}
      >
        <div className="relative">
          {/* Creator profile in top corner */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={project.creator_profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {project.creator_profile?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground">
              {project.creator_profile?.display_name || 'Unknown'}
            </span>
          </div>

          {/* Save button */}
          {user && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSave(project.id);
              }}
              className="absolute top-3 right-3 z-10 p-2 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background transition-colors"
            >
              {isSaved ? (
                <BookmarkCheck className="w-5 h-5 text-primary" />
              ) : (
                <Bookmark className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          )}

          {/* Display header image if available, otherwise main image */}
          {project.header_image_url ? (
            <img
              src={project.header_image_url}
              alt={project.title}
              className="w-full h-48 object-cover"
            />
          ) : project.main_image_url ? (
            <img
              src={project.main_image_url}
              alt={project.title}
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">{project.title}</h3>
            <Badge variant="secondary" className="text-xs">
              {getCategoryLabel(project.category)}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={inlightLogo}
              alt="Inlight"
              className="w-10 h-10 rounded-full object-cover"
            />
            <h1 className="text-2xl font-display font-bold">Projects</h1>
          </div>

        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="relative mb-4 max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Category Filters and Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 flex-1">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="flex-shrink-0"
            >
              All
            </Button>
            {PROJECT_CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className="flex-shrink-0"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="a-z">A → Z</SelectItem>
                <SelectItem value="z-a">Z → A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 mb-6">
              <TabsTrigger value="feed" className="flex-shrink-0 whitespace-nowrap">Feed</TabsTrigger>
              <TabsTrigger value="my-network" className="gap-1 flex-shrink-0 whitespace-nowrap">
                <Users className="w-3 h-3" />
                <span className="hidden sm:inline">My </span>Network
              </TabsTrigger>
              <TabsTrigger value="open-roles" className="flex-shrink-0 whitespace-nowrap">
                <span className="hidden sm:inline">Open </span>Roles
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-shrink-0 whitespace-nowrap">Saved</TabsTrigger>
              <TabsTrigger value="archive" className="gap-1 flex-shrink-0 whitespace-nowrap">
                <Archive className="w-3 h-3" />
                Archive
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="feed">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No projects found for "${searchQuery}"` 
                    : selectedCategory === 'all' 
                      ? 'No projects yet' 
                      : `No ${getCategoryLabel(selectedCategory)} projects yet`}
                </p>
                {user && selectedCategory === 'all' && (
                  <Button onClick={() => setShowCreator(true)} className="mt-4">
                    Create the first project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-network">
            {!user ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Log in to see projects from your network</p>
                <Button onClick={() => navigate('/auth')} className="mt-4">
                  Log In
                </Button>
              </div>
            ) : networkProjects.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No network projects found for "${searchQuery}"` 
                    : 'No projects from your network yet. Connect with more people to see their projects here!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {networkProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="open-roles">
            <OpenRolesFeed />
          </TabsContent>

          <TabsContent value="saved">
            {!user ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Log in to save projects</p>
                <Button onClick={() => navigate('/auth')} className="mt-4">
                  Log In
                </Button>
              </div>
            ) : filteredSavedProjects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No saved projects found for "${searchQuery}"` 
                    : selectedCategory === 'all' 
                      ? 'No saved projects yet' 
                      : `No saved ${getCategoryLabel(selectedCategory)} projects`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSavedProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archive">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredArchivedProjects.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? `No archived projects found for "${searchQuery}"` 
                    : selectedCategory === 'all' 
                      ? 'No archived projects yet. Projects that complete their timeline will appear here.' 
                      : `No archived ${getCategoryLabel(selectedCategory)} projects`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArchivedProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Project Creator Dialog */}
      <ProjectCreator 
        open={showCreator} 
        onOpenChange={setShowCreator}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['projects-feed'] });
        }}
      />
    </div>
  );
};

export default ProjectsPage;
