-- DRAFT: inspection of the pinned image's startup inventory must be reviewed
-- before this setup is run. This is an isolated simulation, not production.
-- Intended release baseline: the November 7 project-removal wording.
-- No notification delivery trigger is installed. Event removal is not tested.
-- auth.users, auth.uid(), auth.role(), the three API roles and gen_random_uuid
-- must already exist. Their definitions and ACLs are NOT simulated here.
-- Before a future run, a privileged operator must separately grant postgres
-- SET on session_replication_role in this disposable scratch cluster only.
-- This setup neither issues that grant nor changes the parameter.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('auth.role()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    RAISE EXCEPTION 'Required auth objects or roles absent; inspect startup inventory';
  END IF;
END $$;
-- No fixture writes are used for preflight. Reject unreviewed Auth behavior
-- rather than assuming defaults, constraints or triggers are harmless.
DO $$
DECLARE a record; v_rls boolean; v_force boolean; v_owner oid; v_bypass boolean;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'Setup and test must run as postgres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND NOT rolsuper) THEN
    RAISE EXCEPTION 'Setup and test require a non-superuser postgres role';
  END IF;
  IF NOT pg_catalog.has_parameter_privilege(current_user,'session_replication_role','SET')
     OR NOT pg_catalog.has_database_privilege(current_user,current_database(),'TEMP')
     OR NOT pg_catalog.has_schema_privilege(current_user,'public','CREATE')
     OR NOT pg_catalog.has_schema_privilege(current_user,'auth','USAGE')
     OR NOT pg_catalog.has_column_privilege(current_user,'auth.users','id','SELECT')
     OR NOT pg_catalog.has_column_privilege(current_user,'auth.users','email','SELECT')
     OR NOT pg_catalog.has_column_privilege(current_user,'auth.users','id','REFERENCES')
     OR NOT pg_catalog.pg_has_role(current_user,'anon','SET')
     OR NOT pg_catalog.pg_has_role(current_user,'authenticated','SET') THEN
    RAISE EXCEPTION 'Required setup or test privilege missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='private') THEN
    RAISE EXCEPTION 'Existing private schema needs separate review; do not alter it';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=ANY(ARRAY['user_roles','connections','groups','group_members','group_admins',
        'projects','project_groups','project_recipients','project_members','project_roles','project_invitations','notifications']))
    OR pg_catalog.to_regtype('public.app_role') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=ANY(ARRAY['has_role','is_invited_to_project','is_group_member',
        'is_group_faculty','is_scoped_group_admin','can_post_to_group','current_user_owns_project',
        'can_access_project','send_notification_email','remove_group_content'])) THEN
    RAISE EXCEPTION 'Simulation object collision; existing objects must not be altered';
  END IF;
  FOR a IN SELECT * FROM (VALUES ('id'),('email'),('created_at')) AS x(col) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute p WHERE p.attrelid='auth.users'::regclass
      AND p.attname=a.col AND p.attnum>0 AND NOT p.attisdropped AND p.attgenerated='' AND p.attidentity='')
      OR NOT pg_catalog.has_column_privilege(current_user,'auth.users',a.col,'INSERT') THEN
      RAISE EXCEPTION 'Auth fixture column missing, generated or not insertable: %', a.col;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute p WHERE p.attrelid='auth.users'::regclass
      AND p.attnum>0 AND NOT p.attisdropped AND p.attname NOT IN ('id','email','created_at')
      AND p.attnotnull AND NOT p.atthasdef AND p.attidentity='' AND p.attgenerated='') THEN
    RAISE EXCEPTION 'Auth fixture has an additional required column without a default';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute p WHERE p.attrelid='auth.users'::regclass
      AND p.attnum>0 AND NOT p.attisdropped AND p.attname NOT IN ('id','email','created_at')
      AND (p.atthasdef OR p.attgenerated<>'' OR p.attidentity<>'')) THEN
    RAISE EXCEPTION 'Unreviewed Auth default, generated or identity column';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='auth.users'::regclass
      AND c.contype IN ('c','x')) THEN
    RAISE EXCEPTION 'Auth check or exclusion constraints require review';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid='auth.users'::regclass
      AND ((NOT t.tgisinternal AND t.tgenabled <> 'D') OR t.tgenabled IN ('R','A'))) THEN
    RAISE EXCEPTION 'Enabled Auth trigger requires review';
  END IF;
  -- Review's full-definition hashes match the inspected container inventory.
  -- Compare both directions, including disabled or unexpected extra hooks.
  IF EXISTS (
    WITH expected(name,event,enabled,tags,signature,owner,definer,definition_md5) AS (VALUES
      ('issue_graphql_placeholder','sql_drop','O',ARRAY['DROP EXTENSION']::text[], 'extensions.set_graphql_placeholder()', 'supabase_admin',false,'4f4a0b1162d1c629f29d40d8fd787e30'),
      ('issue_pg_cron_access','ddl_command_end','O',ARRAY['CREATE EXTENSION']::text[], 'extensions.grant_pg_cron_access()', 'supabase_admin',false,'7f2c6e369fa7d2b6757c21ace6692e4e'),
      ('issue_pg_graphql_access','ddl_command_end','O',ARRAY['CREATE EXTENSION']::text[], 'extensions.grant_pg_graphql_access()', 'supabase_admin',false,'2be0ce49a11c5163eb837b1f21901124'),
      ('issue_pg_net_access','ddl_command_end','O',ARRAY['CREATE EXTENSION']::text[], 'extensions.grant_pg_net_access()', 'supabase_admin',false,'ac0f4432b3074530c78380f30e56aa16'),
      ('pgrst_ddl_watch','ddl_command_end','O',NULL::text[], 'extensions.pgrst_ddl_watch()', 'supabase_admin',false,'c87f2ceb165e84c9f894808613facb4d'),
      ('pgrst_drop_watch','sql_drop','O',NULL::text[], 'extensions.pgrst_drop_watch()', 'supabase_admin',false,'7d26bc43b1e03b4de5aa79cb5b8cb28a')
    ), actual AS (
      SELECT e.evtname::text,e.evtevent::text,e.evtenabled::text,e.evttags,
        pg_catalog.quote_ident(n.nspname)||'.'||pg_catalog.quote_ident(p.proname)||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')',
        pg_catalog.pg_get_userbyid(p.proowner)::text,p.prosecdef,pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid))
      FROM pg_catalog.pg_event_trigger e JOIN pg_catalog.pg_proc p ON p.oid=e.evtfoid
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    )
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    UNION ALL
    (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_event_trigger e JOIN pg_catalog.pg_proc p ON p.oid=e.evtfoid
    WHERE p.proconfig IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Event trigger inventory differs from reviewed baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid='auth.users'::regclass
      AND (i.indexprs IS NOT NULL OR i.indpred IS NOT NULL)) THEN
    RAISE EXCEPTION 'Auth expression or partial index requires review';
  END IF;
  SELECT c.relrowsecurity,c.relforcerowsecurity,c.relowner INTO v_rls,v_force,v_owner
    FROM pg_catalog.pg_class c WHERE c.oid='auth.users'::regclass;
  SELECT r.rolsuper OR r.rolbypassrls INTO v_bypass FROM pg_catalog.pg_roles r WHERE r.rolname=current_user;
  IF v_rls IS NULL OR v_force IS NULL OR v_owner IS NULL OR v_bypass IS NULL
     OR (v_rls AND NOT v_bypass AND (v_force OR v_owner <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user))) THEN
    RAISE EXCEPTION 'Auth RLS access requires review';
  END IF;
  IF NOT pg_catalog.has_schema_privilege('authenticated','auth','USAGE')
     OR NOT pg_catalog.has_function_privilege('authenticated','auth.uid()','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','auth.role()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated Auth helper privilege missing';
  END IF;
END $$;
CREATE SCHEMA private;
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
-- Type ACLs beyond the minimum needed by authenticated tests were not supplied.
REVOKE ALL ON TYPE public.app_role FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON TYPE public.app_role TO authenticated;
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE TABLE public.connections (follower_id uuid NOT NULL, following_id uuid NOT NULL);
CREATE TABLE public.groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
  name text NOT NULL, faculty_owner_id uuid REFERENCES auth.users(id), is_listed boolean NOT NULL DEFAULT false,
  members_can_post boolean NOT NULL DEFAULT true);
CREATE TABLE public.group_members (group_id uuid NOT NULL REFERENCES public.groups(id),
  user_id uuid NOT NULL REFERENCES auth.users(id), status text NOT NULL, PRIMARY KEY(group_id,user_id));
CREATE TABLE public.group_admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES public.groups(id),
  user_id uuid REFERENCES auth.users(id), email text, status text NOT NULL DEFAULT 'active');
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text, main_image_url text,
  creator_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  category text, status text, is_public boolean DEFAULT false, post_approval_required boolean,
  start_date date, end_date date, header_image_url text, company_id uuid, google_drive_url text,
  link_url text, link_title text, slug text UNIQUE, author_identity text, author_group_id uuid,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','network','specific','group','private'))
);
CREATE TABLE public.project_groups (project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,group_id));
CREATE TABLE public.project_recipients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT unique_project_recipient UNIQUE(project_id,recipient_id));
CREATE TABLE public.project_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, user_id uuid NOT NULL,
  role text, joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,user_id));
CREATE TABLE public.project_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, role_name text NOT NULL,
  assigned_user_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.project_invitations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_role_id uuid NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL, receiver_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','accepted','declined')), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  type text NOT NULL, title text NOT NULL, body text, data jsonb DEFAULT '{}', read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());

-- Normalize only objects created in this transaction. Table REVOKE alone does
-- not remove column ACLs inherited from creator default privileges.
DO $$ DECLARE r record; v_cols text; BEGIN
  FOR r IN SELECT c.oid,c.oid::regclass AS obj FROM pg_catalog.pg_class c
    WHERE c.oid IN ('public.user_roles'::regclass,'public.connections'::regclass,
      'public.groups'::regclass,'public.group_members'::regclass,'public.group_admins'::regclass,
      'public.projects'::regclass,'public.project_groups'::regclass,'public.project_recipients'::regclass,
      'public.project_members'::regclass,'public.project_roles'::regclass,'public.project_invitations'::regclass,
      'public.notifications'::regclass) LOOP
    EXECUTE pg_catalog.format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated, service_role',r.obj);
    SELECT pg_catalog.string_agg(pg_catalog.format('%I',a.attname),', ' ORDER BY a.attnum) INTO v_cols
      FROM pg_catalog.pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped;
    EXECUTE pg_catalog.format('REVOKE ALL (%s) ON TABLE %s FROM PUBLIC, anon, authenticated, service_role',v_cols,r.obj);
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'public','private' AS $$ SELECT private.has_role(_user_id,_role) $$;
CREATE FUNCTION private.is_invited_to_project(target_project_id uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.project_invitations pi
JOIN public.project_roles pr ON pr.id=pi.project_role_id WHERE pr.project_id=target_project_id
AND pi.receiver_id=auth.uid() AND pi.status IN ('pending','accepted')) $$;
CREATE FUNCTION public.is_invited_to_project(target_project_id uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path TO 'public','private' AS $$ SELECT private.is_invited_to_project(target_project_id) $$;
CREATE FUNCTION public.is_group_member(_user uuid,_group uuid) RETURNS boolean LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN
 IF _user IS NULL OR _group IS NULL THEN RETURN false; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user) THEN RETURN false; END IF;
 RETURN EXISTS (SELECT 1 FROM public.group_members WHERE user_id=_user AND group_id=_group AND status='active'); END $$;
CREATE FUNCTION public.is_group_faculty(_user uuid,_group uuid) RETURNS boolean LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE _email text; BEGIN
 IF _user IS NULL OR _group IS NULL THEN RETURN false; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _user) THEN RETURN false; END IF;
 IF public.has_role(_user,'admin'::public.app_role) THEN RETURN true; END IF;
 SELECT lower(email) INTO _email FROM auth.users WHERE id=_user;
 RETURN EXISTS (SELECT 1 FROM public.group_admins ga WHERE ga.group_id=_group AND ga.status='active'
  AND (ga.user_id=_user OR (ga.email IS NOT NULL AND _email IS NOT NULL AND lower(ga.email)=_email)))
 OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id=_group AND g.faculty_owner_id=_user); END $$;
CREATE FUNCTION public.is_scoped_group_admin(_user uuid,_group uuid) RETURNS boolean LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE _email text; BEGIN
 IF _user IS NULL OR _group IS NULL THEN RETURN false; END IF;
 SELECT lower(email) INTO _email FROM auth.users WHERE id=_user;
 RETURN EXISTS (SELECT 1 FROM public.group_admins ga WHERE ga.group_id=_group AND ga.status='active'
 AND (ga.user_id=_user OR (ga.email IS NOT NULL AND _email IS NOT NULL AND lower(ga.email)=_email)))
 OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id=_group AND g.faculty_owner_id=_user); END $$;
CREATE FUNCTION public.can_post_to_group(_user uuid,_group uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.is_group_faculty(_user,_group) OR EXISTS
 (SELECT 1 FROM public.groups g JOIN public.group_members gm ON gm.group_id=g.id WHERE g.id=_group
 AND g.members_can_post AND gm.user_id=_user AND gm.status='active') $$;
CREATE FUNCTION public.current_user_owns_project(_project_id uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=_project_id AND p.creator_id=auth.uid()) $$;
CREATE FUNCTION private.can_access_project(target_project_id uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO '' AS $$ SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=target_project_id
 AND (COALESCE(p.is_public,false) OR p.creator_id=auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm
 WHERE pm.project_id=p.id AND pm.user_id=auth.uid()) OR private.is_invited_to_project(p.id)
 OR private.has_role(auth.uid(),'admin'::public.app_role))) $$;
CREATE FUNCTION public.can_access_project(target_project_id uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.projects p
 WHERE p.id=target_project_id AND CASE WHEN p.visibility='group' THEN
 EXISTS (SELECT 1 FROM public.project_groups pg WHERE pg.project_id=p.id AND
 (public.is_group_member(auth.uid(),pg.group_id) OR public.is_group_faculty(auth.uid(),pg.group_id)))
 OR (p.creator_id=auth.uid() AND NOT EXISTS (SELECT 1 FROM public.project_groups pg WHERE pg.project_id=p.id))
 ELSE p.visibility='public' OR COALESCE(p.is_public,false) OR p.creator_id=auth.uid()
 OR public.has_role(auth.uid(),'admin'::public.app_role)
 OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id=p.id AND pm.user_id=auth.uid())
 OR public.is_invited_to_project(p.id)
 OR (p.visibility='network' AND EXISTS (SELECT 1 FROM public.connections c1 JOIN public.connections c2
 ON c1.follower_id=c2.following_id AND c1.following_id=c2.follower_id WHERE c1.follower_id=p.creator_id AND c1.following_id=auth.uid()))
 OR (p.visibility='specific' AND EXISTS (SELECT 1 FROM public.project_recipients pr WHERE pr.project_id=p.id AND pr.recipient_id=auth.uid())) END) $$;

-- Restrict default PUBLIC function execution, then reproduce supplied effective ACLs.
REVOKE ALL ON FUNCTION private.has_role(uuid,public.app_role), private.is_invited_to_project(uuid),
 private.can_access_project(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role), public.is_invited_to_project(uuid),
 public.can_access_project(uuid), public.is_group_member(uuid,uuid), public.is_group_faculty(uuid,uuid),
 public.is_scoped_group_admin(uuid,uuid), public.can_post_to_group(uuid,uuid), public.current_user_owns_project(uuid)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid,public.app_role), private.is_invited_to_project(uuid),
 private.can_access_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role), public.is_invited_to_project(uuid),
 public.can_access_project(uuid), public.is_group_member(uuid,uuid), public.is_group_faculty(uuid,uuid),
 public.is_scoped_group_admin(uuid,uuid), public.can_post_to_group(uuid,uuid), public.current_user_owns_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_invited_to_project(uuid),public.can_access_project(uuid),
 public.is_group_member(uuid,uuid),public.is_group_faculty(uuid,uuid),public.is_scoped_group_admin(uuid,uuid) TO anon;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view accessible projects" ON public.projects FOR SELECT TO authenticated USING
 (COALESCE(is_public,false) OR creator_id=auth.uid() OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id=projects.id AND user_id=auth.uid())
 OR public.is_invited_to_project(id) OR EXISTS (SELECT 1 FROM public.project_groups WHERE project_id=projects.id AND
 (public.is_group_member(auth.uid(),group_id) OR public.is_group_faculty(auth.uid(),group_id))) OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Creators can view unlinked group project bootstrap" ON public.projects FOR SELECT TO authenticated USING
 (visibility='group' AND creator_id=auth.uid() AND NOT EXISTS (SELECT 1 FROM public.project_groups pg WHERE pg.project_id=projects.id));
CREATE POLICY "Authenticated users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid()=creator_id);
CREATE POLICY "Creator can update their projects" ON public.projects FOR UPDATE TO PUBLIC USING (auth.uid()=creator_id);
CREATE POLICY "Admins can update any project" ON public.projects FOR UPDATE TO PUBLIC USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Creator can delete their projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid()=creator_id);
CREATE POLICY "Admins can delete any project" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Members can read project-group links" ON public.project_groups FOR SELECT TO PUBLIC USING (public.is_group_member(auth.uid(),group_id) OR public.is_group_faculty(auth.uid(),group_id));
CREATE POLICY "Project creator can tag own project to an allowed group" ON public.project_groups FOR INSERT TO authenticated WITH CHECK (public.current_user_owns_project(project_id) AND public.can_post_to_group(auth.uid(),group_id));
CREATE POLICY "Project creator or faculty can untag project" ON public.project_groups FOR DELETE TO PUBLIC USING
 (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_groups.project_id AND p.creator_id=auth.uid()) OR public.is_group_faculty(auth.uid(),group_id));
CREATE POLICY "Project owner and recipients can view" ON public.project_recipients FOR SELECT TO PUBLIC USING
 (auth.uid()=recipient_id OR auth.uid() IN (SELECT creator_id FROM public.projects WHERE id=project_recipients.project_id));
CREATE POLICY "Project owner can insert recipients" ON public.project_recipients FOR INSERT TO PUBLIC WITH CHECK
 (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id=project_recipients.project_id));
CREATE POLICY "Project owner can delete recipients" ON public.project_recipients FOR DELETE TO PUBLIC USING
 (auth.uid() IN (SELECT creator_id FROM public.projects WHERE id=project_recipients.project_id));
CREATE POLICY "Authenticated users can view members for accessible projects" ON public.project_members FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY "Project owners and admins can add members" ON public.project_members FOR INSERT TO authenticated WITH CHECK
 (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_members.project_id AND (p.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "Members can leave and project owners or admins can remove membe" ON public.project_members FOR DELETE TO authenticated USING
 (auth.uid()=user_id OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_members.project_id AND (p.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "Authenticated users can view roles for accessible projects" ON public.project_roles FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY "Project owners and admins can add roles" ON public.project_roles FOR INSERT TO authenticated WITH CHECK
 (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_roles.project_id AND (p.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "Project owners and admins can delete roles" ON public.project_roles FOR DELETE TO authenticated USING
 (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_roles.project_id AND (p.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "Project owners and admins can update roles" ON public.project_roles FOR UPDATE TO authenticated USING
 (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_roles.project_id AND (p.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role)))) WITH CHECK
 (EXISTS (SELECT 1 FROM public.projects p WHERE p.id=project_roles.project_id AND (p.creator_id=auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "Project creator can send invitations" ON public.project_invitations FOR INSERT TO PUBLIC WITH CHECK (auth.uid()=sender_id);
CREATE POLICY "Users can view their own invitations" ON public.project_invitations FOR SELECT TO PUBLIC USING (auth.uid()=sender_id OR auth.uid()=receiver_id);
CREATE POLICY "Invitation receiver can update status" ON public.project_invitations FOR UPDATE TO PUBLIC USING (auth.uid()=receiver_id OR auth.uid()=sender_id);

GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_groups,public.project_recipients,public.project_invitations TO anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.project_members TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_roles TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.projects TO anon,authenticated;
GRANT SELECT (id,title,description,main_image_url,creator_id,created_at,category,status,start_date,end_date,header_image_url,link_url,link_title,slug) ON public.projects TO authenticated;

-- Exact source: /tmp/inlight-bug10-notification-setup-20261107.sql:163-213.
-- Deliberately no trigger attaches this delivery function.
create or replace function public.send_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  supabase_url text;
  anon_key text;
  webhook_secret text;
  payload jsonb;
begin
  select decrypted_secret into supabase_url
  from vault.decrypted_secrets
  where name = 'SUPABASE_URL'
  limit 1;

  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'SUPABASE_ANON_KEY'
  limit 1;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'NOTIFICATION_WEBHOOK_SECRET'
  limit 1;

  if supabase_url is null or anon_key is null or webhook_secret is null then
    raise warning 'Missing SUPABASE_URL, SUPABASE_ANON_KEY, or NOTIFICATION_WEBHOOK_SECRET secret for send_notification_email trigger';
    return new;
  end if;

  payload := jsonb_build_object('record', row_to_json(new));

  begin
    perform net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'x-internal-webhook-secret', webhook_secret
      ),
      body := payload
    );
  exception when others then
    raise warning 'Failed to send notification email: %', sqlerrm;
  end;

  return new;
end;
$function$;

-- Exact intended release source: 20261107000000_project_department_removal_notification_body.sql.
create or replace function public.remove_group_content(
  target_group_id uuid, target_content_type text, target_content_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  content_owner uuid;
  content_title text;
  content_path text;
begin
  if not public.is_scoped_group_admin(auth.uid(), target_group_id) then
    raise exception 'Only an active department admin can remove department content';
  end if;

  if target_content_type = 'event' then
    select user_id, title into content_owner, content_title
    from public.events where id = target_content_id;
    if content_owner is null then raise exception 'Event not found'; end if;
    delete from public.event_groups
      where group_id = target_group_id and event_id = target_content_id;
    if not found then raise exception 'Event is not linked to this department'; end if;
    delete from public.event_recipients where event_id = target_content_id;
    update public.events set visibility = 'private' where id = target_content_id;
    content_path := '/events/' || target_content_id::text;
  elsif target_content_type = 'project' then
    select creator_id, title into content_owner, content_title
    from public.projects where id = target_content_id;
    if content_owner is null then raise exception 'Project not found'; end if;
    delete from public.project_groups
      where group_id = target_group_id and project_id = target_content_id;
    if not found then raise exception 'Project is not linked to this department'; end if;
    delete from public.project_recipients where project_id = target_content_id;
    update public.projects set visibility = 'private', is_public = false
      where id = target_content_id;
    content_path := '/projects/' || target_content_id::text;
  else
    raise exception 'Unsupported content type';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    content_owner,
    'department_content_removed',
    initcap(target_content_type) || ' removed from department',
    coalesce(content_title, 'Your ' || target_content_type) ||
      case when target_content_type = 'project' then
        ' was removed from the department feed. You, project members, and invitees keep access. Open it to review its audience.'
      else
        ' is now private and visible only to you. Open it to choose a new audience.'
      end,
    jsonb_build_object('content_type', target_content_type, 'content_id', target_content_id, 'path', content_path)
  );
end
$$;

-- The snapshots are test prerequisites, not delivery endpoints. Their full
-- target ACLs are unknown; do not assume PUBLIC or service-role execution.
REVOKE ALL ON FUNCTION public.send_notification_email(), public.remove_group_content(uuid,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Effective checks include inherited and PUBLIC privileges. Unknown catalog
-- scope (including service-role and supporting-object ACLs) remains a review
-- gap; these assertions do not establish production parity.
DO $$
DECLARE r record; a record; v_expected boolean; v_cols text[] := ARRAY[
 'id','title','description','main_image_url','creator_id','created_at','category','status',
 'start_date','end_date','header_image_url','link_url','link_title','slug'];
BEGIN
  IF NOT pg_catalog.has_schema_privilege('authenticated','public','USAGE')
     OR NOT pg_catalog.has_schema_privilege('anon','public','USAGE')
     OR NOT pg_catalog.has_schema_privilege('authenticated','private','USAGE')
     OR pg_catalog.has_schema_privilege('anon','private','USAGE') THEN
    RAISE EXCEPTION 'Effective schema privileges differ from expected test boundary';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles o ON o.oid=n.nspowner
      WHERE n.nspname='private' AND o.rolname='postgres')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_roles o ON o.oid=t.typowner
      WHERE t.oid='public.app_role'::regtype AND o.rolname='postgres')
     OR NOT pg_catalog.has_type_privilege('authenticated','public.app_role','USAGE') THEN
    RAISE EXCEPTION 'Simulation schema or type ownership/usage mismatch';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('projects',true),('project_groups',true),('project_recipients',true),
    ('project_members',true),('project_roles',true),('project_invitations',true),
    ('groups',false),('group_members',false),('group_admins',false),
    ('user_roles',false),('connections',false),('notifications',false)
  ) AS x(name,rls) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_roles o ON o.oid=c.relowner WHERE n.nspname='public' AND c.relname=r.name
      AND o.rolname='postgres' AND c.relrowsecurity=r.rls AND NOT c.relforcerowsecurity) THEN
      RAISE EXCEPTION 'Unexpected owner or RLS state: %',r.name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) acl
    WHERE c.oid IN ('public.projects'::regclass,'public.project_groups'::regclass,'public.project_recipients'::regclass,
      'public.project_members'::regclass,'public.project_roles'::regclass,'public.project_invitations'::regclass,
      'public.groups'::regclass,'public.group_members'::regclass,'public.group_admins'::regclass,
      'public.user_roles'::regclass,'public.connections'::regclass,'public.notifications'::regclass)
      AND (acl.grantee=0 OR (acl.grantee<>c.relowner AND acl.grantee NOT IN
        ((SELECT oid FROM pg_catalog.pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated')))))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute col JOIN pg_catalog.pg_class c ON c.oid=col.attrelid
      CROSS JOIN LATERAL pg_catalog.aclexplode(col.attacl) acl
      WHERE c.oid IN ('public.projects'::regclass,'public.project_groups'::regclass,'public.project_recipients'::regclass,
        'public.project_members'::regclass,'public.project_roles'::regclass,'public.project_invitations'::regclass,
        'public.groups'::regclass,'public.group_members'::regclass,'public.group_admins'::regclass,
        'public.user_roles'::regclass,'public.connections'::regclass,'public.notifications'::regclass)
        AND (acl.grantee=0 OR (acl.grantee<>c.relowner AND acl.grantee NOT IN
          ((SELECT oid FROM pg_catalog.pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated'))))) THEN
    RAISE EXCEPTION 'Unexpected PUBLIC or other direct table/column ACL';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('projects','SELECT',false,false),('projects','INSERT',true,true),('projects','UPDATE',true,true),('projects','DELETE',true,true),
    ('project_groups','SELECT',true,true),('project_groups','INSERT',true,true),('project_groups','UPDATE',true,true),('project_groups','DELETE',true,true),
    ('project_recipients','SELECT',true,true),('project_recipients','INSERT',true,true),('project_recipients','UPDATE',true,true),('project_recipients','DELETE',true,true),
    ('project_invitations','SELECT',true,true),('project_invitations','INSERT',true,true),('project_invitations','UPDATE',true,true),('project_invitations','DELETE',true,true),
    ('project_members','SELECT',true,false),('project_members','INSERT',true,false),('project_members','UPDATE',false,false),('project_members','DELETE',true,false),
    ('project_roles','SELECT',true,false),('project_roles','INSERT',true,false),('project_roles','UPDATE',true,false),('project_roles','DELETE',true,false)
  ) AS x(name,priv,auth_expected,anon_expected) LOOP
    IF pg_catalog.has_table_privilege('authenticated','public.'||r.name,r.priv) IS DISTINCT FROM r.auth_expected
       OR pg_catalog.has_table_privilege('anon','public.'||r.name,r.priv) IS DISTINCT FROM r.anon_expected THEN
      RAISE EXCEPTION 'Unexpected effective table privilege: % %',r.name,r.priv;
    END IF;
  END LOOP;
  FOR a IN SELECT attname FROM pg_catalog.pg_attribute WHERE attrelid='public.projects'::regclass
    AND attnum>0 AND NOT attisdropped LOOP
    v_expected := a.attname=ANY(v_cols);
    IF pg_catalog.has_column_privilege('authenticated','public.projects',a.attname,'SELECT') IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Unexpected effective project SELECT privilege: %',a.attname;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('public.has_role(uuid,public.app_role)',true,false),('public.is_invited_to_project(uuid)',true,true),
    ('public.can_access_project(uuid)',true,true),('public.is_group_member(uuid,uuid)',true,true),
    ('public.is_group_faculty(uuid,uuid)',true,true),('public.is_scoped_group_admin(uuid,uuid)',true,true),
    ('public.can_post_to_group(uuid,uuid)',true,false),('public.current_user_owns_project(uuid)',true,false),
    ('private.has_role(uuid,public.app_role)',true,false),('private.is_invited_to_project(uuid)',true,false),
    ('private.can_access_project(uuid)',true,false)
  ) AS x(sig,auth_expected,anon_expected) LOOP
    IF pg_catalog.has_function_privilege('authenticated',r.sig,'EXECUTE') IS DISTINCT FROM r.auth_expected
       OR pg_catalog.has_function_privilege('anon',r.sig,'EXECUTE') IS DISTINCT FROM r.anon_expected
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles o ON o.oid=p.proowner
          WHERE p.oid=pg_catalog.to_regprocedure(r.sig) AND o.rolname='postgres') THEN
      RAISE EXCEPTION 'Unexpected effective function privilege or owner: %',r.sig;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
    WHERE p.oid IN ('public.has_role(uuid,public.app_role)'::regprocedure,
      'public.is_invited_to_project(uuid)'::regprocedure,'public.can_access_project(uuid)'::regprocedure,
      'public.is_group_member(uuid,uuid)'::regprocedure,'public.is_group_faculty(uuid,uuid)'::regprocedure,
      'public.is_scoped_group_admin(uuid,uuid)'::regprocedure,'public.can_post_to_group(uuid,uuid)'::regprocedure,
      'public.current_user_owns_project(uuid)'::regprocedure,'private.has_role(uuid,public.app_role)'::regprocedure,
      'private.is_invited_to_project(uuid)'::regprocedure,'private.can_access_project(uuid)'::regprocedure,
      'public.send_notification_email()'::regprocedure,'public.remove_group_content(uuid,text,uuid)'::regprocedure)
      AND (acl.grantee=0 OR (acl.grantee<>p.proowner AND acl.grantee NOT IN
        ((SELECT oid FROM pg_catalog.pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated'))))) THEN
    RAISE EXCEPTION 'Unexpected PUBLIC or other direct function ACL';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles o ON o.oid=p.proowner
    WHERE p.oid IN ('public.send_notification_email()'::regprocedure,
      'public.remove_group_content(uuid,text,uuid)'::regprocedure) AND o.rolname<>'postgres') THEN
    RAISE EXCEPTION 'Unexpected snapshot function owner';
  END IF;
END $$;

COMMIT;
