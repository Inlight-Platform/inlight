# Group Project Preview Permission Fix

The old request used `project_groups?select=project_id,projects(*)`.
The wildcard asks for restricted workflow columns on projects, causing 42501
after column permissions were tightened. The group page now reads permitted
project_ids from project_groups, then requests card fields from projects_browse
for only those ids. Existing group-link RLS and project browse access checks
still decide which rows are returned. No migration or new grants are required.

## Automated Checks

- `npm run typecheck`
- `npm run test:run -- src/lib/groupProjects.test.ts`
- `npm run build:dev`

The focused tests check group/id scoping, the limited projection, empty links,
and error propagation. They mock database responses; actual RLS access must be
verified in the preview environments with the accounts below.

## Sandbox, Then Production Preview

1. Sign in as an active member of a group with an existing linked project.
   Open that group's Projects tab and hard-refresh.
2. In Network, project_groups must select only project_id with that group's
   group_id filter and return HTTP 200. A second projects_browse request must
   filter id to those linked project ids and return HTTP 200. The old
   projects(*) embed and permission denied for table projects error must be gone.
3. Confirm project title, description, images, status, links, and attribution
   still match the existing project. Group-authored projects must show the
   group identity. Personal projects must show the permitted creator profile.
4. Open a project card and verify its existing detail navigation still works.
5. Repeat as an active scoped group admin. Confirm authorized linked projects
   load, including group-only projects.
6. As an unrelated account, open a private group: its projects must remain
   inaccessible. Check an unrelated group's project does not appear among the
   first group's results. Repeat signed out: private projects remain inaccessible.
7. Open a group with no linked projects: expect the normal empty state, without
   an unfiltered projects_browse request or a permission error.
8. Confirm group Posts and Events and Home project cards still work.

Use existing data for production checks. This is a frontend query change, so
production migration workflows and apply-production-migrations labels are not
needed. The flagged security-definer views are a separate pending fix.
