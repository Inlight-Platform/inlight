CREATE TABLE public.project_groups (
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, group_id)
);

GRANT SELECT, INSERT, DELETE ON public.project_groups TO authenticated;
GRANT ALL ON public.project_groups TO service_role;

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read project-group links"
ON public.project_groups FOR SELECT
TO public
USING (is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id));

CREATE POLICY "Project creator can tag own project to a group they belong to"
ON public.project_groups FOR INSERT
TO public
WITH CHECK ((EXISTS (SELECT 1 FROM projects p WHERE p.id = project_groups.project_id AND p.creator_id = auth.uid())) AND (is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id)));

CREATE POLICY "Project creator or faculty can untag project"
ON public.project_groups FOR DELETE
TO public
USING ((EXISTS (SELECT 1 FROM projects p WHERE p.id = project_groups.project_id AND p.creator_id = auth.uid())) OR is_group_faculty(auth.uid(), group_id));