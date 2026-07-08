-- Tighten client-callable RPC privileges.
--
-- Supabase exposes PostgreSQL functions as RPC endpoints. SECURITY DEFINER
-- functions can read/write through their owner privileges, so execute access
-- should be explicit. This migration removes anonymous access from admin and
-- authenticated-only functions, while preserving intentionally public/token
-- based flows.

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

do $$
declare
  fn text;
  reg regprocedure;
begin
  foreach fn in array array[
    -- Internal helpers/triggers. These should not be directly callable as RPCs
    -- by anon or authenticated clients.
    'public.accept_platform_invite_on_signup()',
    'public.assert_company_staff_token(text)',
    'public.get_company_staff_access_public(uuid)',
    'public.handle_user_email_confirmed()',
    'public.notify_admins_company_request()',
    'public.notify_requester_company_request_status()'
  ]
  loop
    reg := to_regprocedure(fn);
    if reg is not null then
      execute 'revoke all on function ' || reg || ' from public, anon, authenticated';
    end if;
  end loop;

  foreach fn in array array[
    -- Admin/reporting RPCs.
    'public.get_admin_user_growth()',
    'public.get_admin_profile_duplicate_report()',
    'public.get_admin_user_count_summary()',
    'public.get_admin_showcase_site_metrics(integer)',
    'public.get_admin_page_metrics(integer)',
    'public.get_admin_analytics_summary(integer)',

    -- Admin/company approval RPCs.
    'public.approve_company_account_request(uuid,text)',
    'public.deny_company_account_request(uuid,text)',
    'public.finalize_company_account_approval(uuid,uuid,text)',
    'public.get_company_requester_profiles(uuid[])',
    'public.is_platform_inviter(uuid)',

    -- Authenticated-only app RPCs.
    'public.add_company_staff_access(uuid,text,timestamptz)',
    'public.add_company_staff_access(uuid,text,text,timestamptz)',
    'public.admin_create_company_page(text,text,text,text[])',
    'public.admin_create_company_page(text,text,text,jsonb)',
    'public.create_platform_invite(text,text)',
    'public.create_project_credit_invite(text,uuid,text)',
    'public.accept_project_invitation(uuid)',
    'public.accept_project_credit_invite(text)',
    'public.claim_invites_on_signup(text,text)',
    'public.get_my_role_applications_for_jobs()',
    'public.mark_event_attended(uuid)',
    'public.mark_show_attended(uuid)',
    'public.remove_profile_attendance(text,uuid)',

    -- Private/email helpers that should not be anonymous RPCs.
    'public.get_notification_email_recipient(uuid)',
    'public.mark_job_match_email_sent(uuid,timestamp with time zone)',

    -- Private helpers. These may be used internally by policies or wrappers,
    -- but anonymous clients should not be able to execute them directly.
    'private.add_project_member_by_email(uuid,text,text)',
    'private.can_access_project(uuid)',
    'private.can_view_post(public.posts)',
    'private.get_2nd_degree_connections(uuid)',
    'private.get_message_privacy(uuid)',
    'private.get_mutual_connections(uuid)',
    'private.has_role(uuid,public.app_role)',
    'private.is_invited_to_project(uuid)',
    'private.user_media_owner_matches_email(uuid,text)'
  ]
  loop
    reg := to_regprocedure(fn);
    if reg is not null then
      execute 'revoke all on function ' || reg || ' from public, anon';
      execute 'grant execute on function ' || reg || ' to authenticated';
    end if;
  end loop;
end $$;

do $$
declare
  fn text;
  reg regprocedure;
begin
  foreach fn in array array[
    -- Public signup checks. These are intentionally available before login.
    'public.is_signup_email_allowed(text)',
    'public.is_signup_email_allowed(text,text)',
    'public.is_signup_email_allowed(text,text,text)',

    -- Company staff token flows. These are token-gated and used before a
    -- company staff member necessarily has an authenticated session.
    'public.validate_company_staff_access(text)',
    'public.update_company_with_staff_token(text,text,text,text,text,text,text,text,text,text,text,text,jsonb)',
    'public.add_company_photo_with_staff_token(text,text,text)',
    'public.delete_company_photo_with_staff_token(text,uuid)',
    'public.create_company_project_with_staff_token(text,text,text,text,text,text,date,date,text,text)',

    -- Public-safe profile helpers.
    'public.get_public_profiles(uuid[])',
    'public.profile_is_visible_to_current_user(uuid)',
    'public.current_user_can_view_hidden_profiles()',

    -- Public event RSVP listing helper. This returns only the public-safe RSVP
    -- fields chosen by the function body.
    'public.get_public_event_rsvps(uuid)',

    -- Keep existing signup duplicate check behavior for now. This endpoint can
    -- reveal whether an email exists, so it should stay on the security review
    -- list if abuse/rate limiting becomes a concern.
    'public.check_email_exists_for_signup(text)'
  ]
  loop
    reg := to_regprocedure(fn);
    if reg is not null then
      execute 'revoke all on function ' || reg || ' from public';
      execute 'grant execute on function ' || reg || ' to anon, authenticated';
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
