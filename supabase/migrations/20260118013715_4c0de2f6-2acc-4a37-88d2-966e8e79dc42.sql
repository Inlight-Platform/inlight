-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  main_image_url TEXT,
  creator_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project members (users who are part of a project)
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Project photos (additional photos any member can add)
CREATE TABLE public.project_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Saved projects (users can save projects)
CREATE TABLE public.saved_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_projects ENABLE ROW LEVEL SECURITY;

-- Projects policies: anyone can view, authenticated users can create
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creator can update their projects" ON public.projects FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creator can delete their projects" ON public.projects FOR DELETE USING (auth.uid() = creator_id);

-- Project members policies
CREATE POLICY "Anyone can view project members" ON public.project_members FOR SELECT USING (true);
CREATE POLICY "Project creator can add members" ON public.project_members FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_id));
CREATE POLICY "Project creator or member themselves can remove membership" ON public.project_members FOR DELETE 
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_id));

-- Project photos policies
CREATE POLICY "Anyone can view project photos" ON public.project_photos FOR SELECT USING (true);
CREATE POLICY "Project members can add photos" ON public.project_photos FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.project_members WHERE project_id = project_photos.project_id) 
    OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_id));
CREATE POLICY "Photo owner or project creator can delete photos" ON public.project_photos FOR DELETE 
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id = project_id));

-- Saved projects policies
CREATE POLICY "Users can view their saved projects" ON public.saved_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save projects" ON public.saved_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave projects" ON public.saved_projects FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();