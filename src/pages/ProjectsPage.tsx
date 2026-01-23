import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Bookmark, BookmarkCheck, Filter, Search, X, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import PageLayout from '@/components/layout/PageLayout';

type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';

interface Project {
  id: string;
  title: string;
  description: string | null;
  main_image_url: string | null;
  creator_id: string;
  created_at: string;
  category: string | null;
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
        .from('profiles')
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
        .from('profiles')
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

  const filteredProjects = sortProjects(filterBySearch(
    selectedCategory === 'all' 
      ? projects 
      : projects.filter(p => p.category === selectedCategory)
  ));

  const filteredSavedProjects = sortProjects(filterBySearch(
    selectedCategory === 'all'
      ? savedProjectDetails
      : savedProjectDetails.filter(p => p.category === selectedCategory)
  ));

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

          {/* Main project image */}
          {project.main_image_url ? (
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
    <PageLayout>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, hsl(264 100% 71%), hsl(280 100% 65%))',
                boxShadow: '0 0 20px hsl(264 100% 71% / 0.4)'
              }}
            >
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold">Projects</h1>
          </div>

          {user && (
            <Button onClick={() => setShowCreator(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Bar */}
        <div className="relative mb-4">
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
          <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="open-roles">Open Roles</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>

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
    </PageLayout>
  );
};

export default ProjectsPage;
