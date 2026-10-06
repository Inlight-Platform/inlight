# INV96 Phases 1-2.5 - Row-Level Security Survey, Classification, and Column Minimization

## Survey provenance

- Survey date: 2026-09-28
- Worktree: `/Users/clely/.codex/worktrees/inv96-rls-review/inlight`
- Branch: `codex/inv96-rls-review`
- Base: local `origin/main` at `21f034010c15ad2f61c2051b1520a7e2f5601367` (2026-09-28)
- Supabase API surveyed: `http://127.0.0.1:54321`
- PostgreSQL surveyed: local Docker database at `127.0.0.1:54322`
- Runtime environment convention: local runs use the original checkout's `.env.sandbox.local`, whose `VITE_SUPABASE_URL` is `http://127.0.0.1:54321`.
- `supabase/config.toml` retains hosted project ID `piofmmawwnermvaysonw` by user direction. No hosted Supabase command was run.
- GitHub was not contacted. The user supplied and the local tracking ref resolved to `21f034010c15ad2f61c2051b1520a7e2f5601367`.

## Method and limits

- Tables, RLS state, and policies were extracted from the running local database after a clean local `supabase db reset` from this worktree.
- Policy expressions below are the effective local definitions, with whitespace collapsed only for readability.
- Application access references include direct literal `supabase.from('table')` calls in runtime `src/` and `supabase/functions/` TypeScript/JavaScript.
- Test files, generated Supabase types, storage bucket calls, dynamic table names, and RPC-mediated table access are excluded from direct-access references.
- A missing direct reference means no matching runtime call was found; it does not prove the table is unused because triggers, functions, views, or external clients may access it.

## Headline results

- Public tables: **70**
- Tables with RLS enabled: **70**
- Tables with RLS disabled: **0**
- Effective policies: **257**
- Tables with no effective policy: **1** (`group_chat_messages`)
- Tables with direct runtime reads or writes: **68**
- Tables with a literal `USING (true)` or `WITH CHECK (true)`: **22**

### Scan reconciliation note

The exact Lovable list supplied on 2026-09-28 contains 28 tables. The effective local schema contains literal-true policies across 22 tables:

`broadway_metrics`, `companies`, `company_photos`, `credit_vouches`, `credits`, `film_metrics`, `groups`, `industry_highlights`, `nyc_shows`, `opportunities`, `profile_flipbook`, `projects`, `show_teammates`, `show_tips`, `streaming_content`, `studio_comments`, `studio_posts`, `studios`, `tip_votes`, `user_films`, `user_music_shows`, `vouches`.

The exact intersection is **21 tables**. These scanner entries are covered by the local literal-true set:

`broadway_metrics`, `companies`, `company_photos`, `credit_vouches`, `credits`, `film_metrics`, `groups`, `industry_highlights`, `nyc_shows`, `opportunities`, `profile_flipbook`, `show_teammates`, `show_tips`, `streaming_content`, `studio_comments`, `studio_posts`, `studios`, `tip_votes`, `user_films`, `user_music_shows`, `vouches`.

Against the preserved `fe33c38` survey, the scanner list had eight entries outside the local literal-true set: `groups` plus the seven listed below. After the clean reset on the new `21f0340` base, `groups` resolves to a literal-true policy; the other seven still do not. `projects` also resolves to literal-true locally, but it is not in the scanner's 28. This is a difference between the two surveyed local database states, not a tracked migration change between the Git bases.

The scanner's remaining **seven** entries are not missing as local tables. Every one exists in the local `public` schema with RLS enabled, but none has a literal `USING (true)` or `WITH CHECK (true)` policy:

| Scanner table not in literal-true set | Effective local read rule | Reconciliation |
| --- | --- | --- |
| `connections` | Both endpoint profiles must pass `profile_is_visible_to_current_user(...)`. | Scanner counting differs from the literal-true test. The rule is defined in `supabase/migrations/20260622220000_hide_test_accounts_from_public_surfaces.sql:106`. |
| `project_photos` | `can_access_project(project_id)`. | Scanner counting differs. The rule is defined in `supabase/migrations/20260503090000_secure_projects_and_realtime.sql:53`. |
| `project_roles` | `can_access_project(project_id)`; anonymous visitors also get rows for public company-linked projects. | Scanner counting differs. The general rule is in `supabase/migrations/20260503090000_secure_projects_and_realtime.sql:60`, and the anonymous rule is in `supabase/migrations/20260808120000_public_platform_access_foundation.sql:94`. |
| `event_rsvps` | Own RSVP, event creator, or admin only; the public display path uses a separate RPC. | Scanner counting differs. The current restrictive rules originate in `supabase/migrations/20260503080000_secure_event_rsvps.sql:4` and coexist with older overlapping rules in `supabase/migrations/20260529140053_c7272073-5129-4720-81c7-59bc246e2042.sql:14`. |
| `project_links` | `can_access_project(project_id)`. | Scanner counting differs. The rule is defined in `supabase/migrations/20260630170000_add_project_links.sql:17`. |
| `project_members` | `can_access_project(project_id)`; anonymous visitors also get rows for public company-linked projects. | Scanner counting differs. The general rule is in `supabase/migrations/20260503090000_secure_projects_and_realtime.sql:46`, and the anonymous rule is in `supabase/migrations/20260808120000_public_platform_access_foundation.sql:79`. |
| `events` | `can_view_event(events.*)`. | Scanner counting differs. The current rule is defined in `supabase/migrations/20260907204500_add_event_audience_visibility.sql:76`. |

This rules out a non-public-schema explanation: all seven are local `public` tables. The repository also contains their table definitions and policies, so there is no repository evidence that a hosted-only migration is needed to explain them. Because hosted Supabase was not queried, hosted drift itself is not verified. The only explanation supported by the local evidence is that Lovable counts policies differently, for example treating a policy granted to `PUBLIC` or `anon` as scanner-relevant even when its row predicate is conditional. **CONFIRM WITH CLELY:** the scanner's exact matching rule and the hosted schema revision used for the scan.

The inverse difference is `projects`: it is in the local literal-true set but absent from the scanner's 28. Its literal-true policy applies only to `authenticated`; visitors have a separate `is_public` predicate (`supabase/migrations/20260808120000_public_platform_access_foundation.sql:43`). This is further evidence that the scanner's 28 is not an inventory of every literal-true policy.

## Phase 2 classification

### Groups and projects first

**Projects are intentional browse-mode behavior, not an unrestricted anonymous-read hole.** `/projects`, `/projects/:projectId`, and the public company-project route are not wrapped in `RequireAuth` (`src/App.tsx:88`, `src/App.tsx:117`, `src/App.tsx:119`). The project feed deliberately requests all projects for signed-in users and adds `is_public = true` only for visitors (`src/pages/ProjectsPage.tsx:57`). The policies mirror that split: authenticated users have the literal-true read, while `anon` is constrained by `is_public` (`supabase/migrations/20260808120000_public_platform_access_foundation.sql:43`). Project members, photos, roles, and links are then fetched on the detail page (`src/pages/ProjectDetailPage.tsx:233`, `src/pages/ProjectDetailPage.tsx:258`, `src/pages/ProjectDetailPage.tsx:280`, `src/pages/ProjectDetailPage.tsx:306`) and inherit `can_access_project(...)`. Classification: **keep the browse model; review column projection because the feed and detail query `select('*')`.**

**Groups contain intentional public metadata lookup, but table-wide public read is a hole relative to the app's demonstrated need.** `/groups/:slug` is reachable without `RequireAuth` (`src/App.tsx:124`), and `useGroupBySlug` explicitly says anyone can read group metadata and resolves one row by slug (`src/hooks/useGroups.ts:36`). The page separately gates membership and posts behind `canViewPrivateGroup` (`src/pages/GroupPage.tsx:74`, `src/pages/GroupPage.tsx:154`, `src/pages/GroupPage.tsx:179`). The current `groups` schema has no public/listed flag (`src/integrations/supabase/types.ts:911`), while `Groups readable by everyone` exposes every row and `faculty_owner_id` (`supabase/migrations/20260626213810_0c9e5ab2-7055-4d70-9250-b41e36ee7225.sql:15`). Classification: **tighten**. Preserve public slug resolution, but do not equate it with anonymous enumeration of the whole table. **CONFIRM WITH CLELY:** whether all group names, descriptions, slugs, and faculty-owner IDs are intended to be discoverable; the current schema cannot express a listed/private distinction.

### Scanner-table decisions

`Keep` means the current read shape is directly used by an unauthenticated or broadly browsable product surface. `Keep conditional` means no unrestricted local read exists and the predicate matches the consuming workflow. `Tighten` means the current app needs some read access but not all rows or columns exposed by the policy. `Confirm` means current runtime code does not establish a need.

| Table | Local exposure | Phase 2 classification and repo-grounded reason |
| --- | --- | --- |
| `profile_flipbook` | Anonymous literal-true | **Confirm.** No direct runtime read exists in `src/` or an Edge Function; generated types alone do not establish product intent. **CONFIRM WITH CLELY** before retaining public access. |
| `tip_votes` | Anonymous literal-true | **Tighten.** The UI reads only the signed-in user's `tip_id` rows (`src/components/stage-whisper/ShowDetailSheet.tsx:156`), while the policy exposes every voter's `user_id`. Public totals should come from `show_tips.helpful_count` or an aggregate; raw voter identity is not required by this code. |
| `user_music_shows` | Anonymous literal-true | **Tighten.** Public browse is intentional (`src/pages/StageWhisperPage.tsx:210`), but the page selects every column and the row includes both `is_anonymous` and `submitted_by` (`src/integrations/supabase/types.ts:2799`). An anonymous submission's author ID is therefore still queryable. |
| `vouches` | Anonymous literal-true | **Tighten.** The UI reads a caller-specific existence check, while the displayed count comes from `profiles_public.vouch_count` (`src/hooks/useVouch.ts:10`, `src/hooks/useVouch.ts:34`). Public access to all voucher IDs and endorsement messages is not required by this code. |
| `connections` | Conditional `PUBLIC` | **Keep conditional.** Network code reads follower/following IDs (`src/hooks/useNetworkConnections.ts:51`), and RLS filters both endpoints through profile visibility rather than `true`. Verify the helper separately before changing this policy. |
| `project_photos` | Conditional `PUBLIC` | **Keep conditional.** The public project detail consumes photos (`src/pages/ProjectDetailPage.tsx:258`), and RLS delegates visibility to `can_access_project(project_id)`. |
| `user_films` | Anonymous literal-true | **Tighten.** Public browse is intentional (`src/pages/StageWhisperPage.tsx:192`), but `select('*')` returns `submitted_by` even when `is_anonymous` is true (`src/integrations/supabase/types.ts:2712`). |
| `streaming_content` | Anonymous literal-true | **Keep.** It is catalog content managed through `src/components/admin/FilmContentManager.tsx:97`; its generated row shape contains titles, platform, ratings, poster/watch URLs, and publication state, not user-private fields (`src/integrations/supabase/types.ts:2407`). |
| `project_roles` | Conditional `PUBLIC` plus conditional `anon` | **Keep conditional.** Project detail and open-role surfaces consume it (`src/pages/ProjectDetailPage.tsx:280`, `src/components/projects/OpenRolesFeed.tsx:121`); local predicates tie reads to project access/public company projects. |
| `credit_vouches` | Anonymous literal-true | **Tighten.** The hook currently fetches all rows to calculate a count and whether the current user voted (`src/hooks/useCreditVerification.ts:31`). That is a functional dependency, but it exposes every `voucher_id`; replace with aggregate count plus caller-specific state when this area is redesigned. |
| `studios` | Anonymous literal-true | **Keep.** The browse UI loads the studio directory (`src/components/insights/SchoolStudios.tsx:64`), and the table is descriptive catalog metadata (`src/integrations/supabase/types.ts:2525`). |
| `event_rsvps` | Creator/admin/self predicates; no unrestricted SELECT | **Keep conditional.** Private rows contain name, email, custom answers, and attendance (`src/integrations/supabase/types.ts:480`). The ordinary display path uses `get_public_event_rsvps`, while direct `select('*')` is the explicit `includePrivate` path (`src/hooks/useEventRsvps.ts:24`). The scanner entry is not a local public-read hole. |
| `company_photos` | Anonymous literal-true | **Keep, minimize columns.** The public company page needs `id` and `image_url` (`src/pages/PublicCompanyPage.tsx:41`), but the policy also makes `uploaded_by` queryable. Public gallery access is intentional; exposing uploader identity is not shown to be required. |
| `project_links` | Conditional `PUBLIC` | **Keep conditional.** Project detail consumes links (`src/pages/ProjectDetailPage.tsx:306`), and RLS applies `can_access_project(project_id)`. |
| `show_teammates` | Anonymous literal-true | **Keep.** Show detail loads teammate identities (`src/components/stage-whisper/ShowDetailSheet.tsx:107`); those rows are part of the public show presentation. **CONFIRM WITH CLELY** that teammate attribution is always public. |
| `studio_comments` | Anonymous literal-true | **Keep.** The browse surface reads comments and joins public profile labels (`src/components/insights/SchoolStudios.tsx:105`), consistent with public community content. |
| `studio_posts` | Anonymous literal-true | **Keep.** The same browse surface reads studio posts and public author labels (`src/components/insights/SchoolStudios.tsx:77`). |
| `project_members` | Conditional `PUBLIC` plus conditional `anon` | **Keep conditional.** Both project detail and the public company-project page display membership (`src/pages/ProjectDetailPage.tsx:233`, `src/pages/PublicCompanyProjectPage.tsx:26`); anonymous access is limited to public company-linked projects. |
| `nyc_shows` | Anonymous literal-true | **Tighten.** Public show browsing is intentional (`src/pages/StageWhisperPage.tsx:133`), but the row has both `is_anonymous` and `submitted_by` and the page selects every column (`src/integrations/supabase/types.ts:1043`). |
| `show_tips` | Anonymous literal-true | **Keep, confirm attribution.** Public tips are loaded on show detail and include author IDs (`src/components/stage-whisper/ShowDetailSheet.tsx:77`). **CONFIRM WITH CLELY** that tip authorship, not only tip content, is intended to be public. |
| `broadway_metrics` | Anonymous literal-true | **Keep.** The insights surface reads industry metrics (`src/components/insights/IndustryMetrics.tsx:79`), and the row is aggregate show-performance data (`src/integrations/supabase/types.ts:103`). |
| `companies` | Anonymous literal-true | **Keep, minimize columns.** A dedicated unauthenticated company route queries the row (`src/App.tsx:88`, `src/pages/PublicCompanyPage.tsx:13`). Public company presentation is intentional; `owner_user_id` is not shown to be needed by that route. |
| `groups` | Anonymous literal-true | **Tighten.** Public slug resolution is intentional, but anonymous table-wide enumeration and exposure of `faculty_owner_id` are broader than the route requires. See “Groups and projects first.” |
| `events` | Conditional `PUBLIC` | **Keep conditional.** Public feed/detail routes consume events (`src/App.tsx:105`, `src/pages/FeedPage.tsx:565`), and RLS delegates each row to `can_view_event(events.*)` rather than `true`. |
| `industry_highlights` | Anonymous literal-true | **Keep.** The insights surface reads editorial highlights (`src/components/insights/IndustryMetrics.tsx:94`), and the row contains category, content, and date (`src/integrations/supabase/types.ts:941`). |
| `opportunities` | Authenticated literal-true; anonymous `is_public` | **Keep.** `/opportunities` is a browse route (`src/App.tsx:109`), and the policy intentionally distinguishes all signed-in access from public-only visitor access. |
| `credits` | Anonymous literal-true | **Keep, confirm profile intent.** Public profile code uses credits (`src/pages/ProfilePage.tsx:561`), and the row is portfolio data. **CONFIRM WITH CLELY** that every credit row, including unverified credits, should be public rather than only profile-approved records. |
| `film_metrics` | Anonymous literal-true | **Keep.** Stage Whisper reads box-office/rating rows as public catalog data (`src/pages/StageWhisperPage.tsx:151`). |

### Phase 2 outcome

- **Keep:** 10 tables (`broadway_metrics`, `film_metrics`, `industry_highlights`, `streaming_content`, `studios`, `studio_posts`, `studio_comments`, `opportunities`, plus public-read portions of `companies` and `company_photos`). The last two still need column minimization.
- **Keep conditional:** 7 scanner tables (`connections`, `project_photos`, `project_roles`, `event_rsvps`, `project_links`, `project_members`, `events`). These are the seven scanner entries that were absent from the literal-true set.
- **Tighten:** 7 tables (`groups`, `tip_votes`, `vouches`, `credit_vouches`, `user_films`, `user_music_shows`, `nyc_shows`). The last three expose submitter IDs despite an anonymity flag.
- **Keep but confirm a product-level privacy decision:** 3 tables (`show_teammates`, `show_tips`, `credits`).
- **Unproven / confirm before retaining:** 1 table (`profile_flipbook`), because no direct runtime consumer was found.
- **Outside the scanner 28:** `projects` is intentional authenticated browse behavior with separately constrained anonymous access; retain the access model and minimize `select('*')` projections.

No policy or application change is made in Phase 2. This section classifies the observed state only.

## Phase 2.5 - column minimization

This phase is a read-only projection review. PostgreSQL RLS decides which rows may be read; the current policies do not restrict columns. Therefore a caller allowed to select a row can request every column listed in the generated `Row` type, even when the current UI asks for or renders only a subset. `Keep` below means keep the column in a purpose-built public/browse projection. `Hide` means omit it from that projection; it does not mean drop the database column.

The reviewed browse surfaces are `/people`, `/c/:companyId`, `/company/:companyId`, `/projects`, `/projects/:projectId`, `/feed`, and `/c/:companyId/project/:projectId` (`src/App.tsx:88`, `src/App.tsx:89`, `src/App.tsx:101`, `src/App.tsx:102`, `src/App.tsx:117`, `src/App.tsx:119`, `src/App.tsx:121`). The principal over-fetching calls are `companies.select('*')` in `src/hooks/useCompanyFollows.ts:30`, `src/pages/PublicCompanyPage.tsx:16`, and `src/pages/CompanyProfilePage.tsx:940`; `company_photos.select('*')` in `src/pages/CompanyProfilePage.tsx:996`; and `projects.select('*')` in `src/pages/FeedPage.tsx:506`, `src/pages/ProjectsPage.tsx:61`, `src/pages/ProjectDetailPage.tsx:198`, and `src/pages/PublicCompanyProjectPage.tsx:14`.

### `public.companies` browse projection

The unrestricted read policy is `Companies are viewable by everyone` (`supabase/migrations/20260216220558_096ef311-8189-40fd-bdb0-8ea6a84ed63a.sql:16`). Its full 16-column row shape is recorded at `src/integrations/supabase/types.ts:142`.

| Column | Used by UI? | Keep or hide |
| --- | --- | --- |
| `brand_accent_color` | Yes. Public company theming reads it at `src/pages/PublicCompanyPage.tsx:100`; the in-app company page does the same at `src/pages/CompanyProfilePage.tsx:1032`. | **Keep.** |
| `brand_primary_color` | Yes. Used for public company colors at `src/pages/PublicCompanyPage.tsx:99` and `src/pages/CompanyProfilePage.tsx:1031`. | **Keep.** |
| `brand_text_color` | Yes. Used for fun-fact text at `src/pages/PublicCompanyPage.tsx:101` and `src/pages/CompanyProfilePage.tsx:1033`. | **Keep.** |
| `cover_image_url` | Yes. Rendered in the public hero at `src/pages/PublicCompanyPage.tsx:125` and the in-app hero at `src/pages/CompanyProfilePage.tsx:1144`. | **Keep.** |
| `created_at` | No browse component reads the returned value. The admin tracker uses it, but that is not a public/browse surface (`src/components/admin/CompanyRequestsManager.tsx:778`). | **Hide** from the browse projection. |
| `description` | Yes. Rendered on the public company page at `src/pages/PublicCompanyPage.tsx:175` and on directory cards at `src/components/people/CompanyCard.tsx:40`. | **Keep.** |
| `fun_facts` | Yes. Parsed and rendered at `src/pages/PublicCompanyPage.tsx:102` and `src/pages/CompanyProfilePage.tsx:1034`. | **Keep.** |
| `id` | Yes. Used for company navigation and follow actions at `src/components/people/CompanyCard.tsx:22` and `src/components/people/CompanyCard.tsx:50`. | **Keep.** |
| `location` | Yes. Rendered at `src/pages/PublicCompanyPage.tsx:163` and `src/components/people/CompanyCard.tsx:43`. | **Keep.** |
| `logo_url` | Yes. Rendered at `src/pages/PublicCompanyPage.tsx:116` and `src/components/people/CompanyCard.tsx:32`. | **Keep.** |
| `mission` | Yes. Rendered at `src/pages/PublicCompanyPage.tsx:181` and `src/pages/CompanyProfilePage.tsx:1244`. | **Keep.** |
| `name` | Yes. Rendered throughout the public page, beginning at `src/pages/PublicCompanyPage.tsx:116`, and on directory cards at `src/components/people/CompanyCard.tsx:34`. | **Keep.** |
| `owner_user_id` | Yes, but only for owner-profile lookup and client-side management state: `src/pages/CompanyProfilePage.tsx:957` and `src/pages/CompanyProfilePage.tsx:1007`. The anonymous public-company page does not consume it. | **Hide** from the public/browse projection. Replace the management dependency with an authorization-scoped owner lookup or `can_manage` result; do not expose the owner's UUID to every anonymous caller merely to decide which controls to render. |
| `tagline` | Yes. Rendered at `src/pages/PublicCompanyPage.tsx:160` and `src/pages/CompanyProfilePage.tsx:1188`. | **Keep.** |
| `updated_at` | No public or browse UI consumption found. | **Hide** from the browse projection. |
| `website_url` | Yes. Rendered as a public link at `src/pages/PublicCompanyPage.tsx:165` and `src/pages/CompanyProfilePage.tsx:1287`. | **Keep.** |

Recommended browse column set: `brand_accent_color`, `brand_primary_color`, `brand_text_color`, `cover_image_url`, `description`, `fun_facts`, `id`, `location`, `logo_url`, `mission`, `name`, `tagline`, `website_url`. Hide `created_at`, `owner_user_id`, and `updated_at` from the public/browse projection. **CONFIRM WITH CLELY:** whether public identification of the company owner is a product requirement; no current anonymous rendering depends on it.

### `public.company_photos` browse projection

The unrestricted read policy is `Anyone can view company photos` (`supabase/migrations/20260216230056_8a04e0c7-d047-4f0e-a69b-15afd745feda.sql:21`). Its full six-column row shape is recorded at `src/integrations/supabase/types.ts:282`. The dedicated public page already requests only `id, image_url` (`src/pages/PublicCompanyPage.tsx:41`), while the in-app company page requests every column (`src/pages/CompanyProfilePage.tsx:992`). Filtering or ordering by a column does not require returning that column.

| Column | Used by UI? | Keep or hide |
| --- | --- | --- |
| `caption` | Yes. Used as image alternative text on the in-app company gallery at `src/pages/CompanyProfilePage.tsx:1471`. | **Keep.** |
| `company_id` | No returned-value use. Both queries filter by it (`src/pages/PublicCompanyPage.tsx:47`, `src/pages/CompanyProfilePage.tsx:999`), but it need not be selected. | **Hide** from the browse response. |
| `created_at` | No returned-value use. It is only an ordering key (`src/pages/PublicCompanyPage.tsx:48`, `src/pages/CompanyProfilePage.tsx:1000`). | **Hide** from the browse response. |
| `id` | Yes. Used as the gallery key/link identity at `src/pages/PublicCompanyPage.tsx:321` and as the key/delete target at `src/pages/CompanyProfilePage.tsx:1469`. | **Keep.** |
| `image_url` | Yes. Rendered by both galleries at `src/pages/PublicCompanyPage.tsx:322` and `src/pages/CompanyProfilePage.tsx:1471`. | **Keep.** |
| `uploaded_by` | No read-side UI use found. It is supplied when uploading at `src/pages/CompanyProfilePage.tsx:1056`, but the public policy makes it readable afterward. | **Hide** from the public/browse projection. |

Recommended browse column set: `caption`, `id`, `image_url`. Hide `company_id`, `created_at`, and `uploaded_by` from the returned public payload. `uploaded_by` remains necessary on writes and for server-side authorization/audit; neither requires exposing it to public readers.

### `public.projects` browse projection

The full 19-column row shape is recorded at `src/integrations/supabase/types.ts:1911`. Anonymous readers can read rows where `is_public` is true, and authenticated readers can read all rows (`supabase/migrations/20260808120000_public_platform_access_foundation.sql:43`). Both policies expose every column of an allowed row. The feed and project directory deliberately use project fields to build browse cards (`src/pages/FeedPage.tsx:778`, `src/pages/ProjectsPage.tsx:150`), while project detail uses additional presentation and management fields.

| Column | Used by UI? | Keep or hide |
| --- | --- | --- |
| `category` | Yes. Used for directory filtering/rendering at `src/pages/ProjectsPage.tsx:193` and public company-project display at `src/pages/PublicCompanyProjectPage.tsx:70`. | **Keep.** |
| `company_id` | No returned-value use on the reviewed browse surfaces. Public company queries filter by it at `src/pages/PublicCompanyPage.tsx:33` and `src/pages/PublicCompanyProjectPage.tsx:18`. | **Hide** from the browse response; retain it for filtering and authorized management. |
| `created_at` | Yes. Drives oldest/newest sorting at `src/pages/ProjectsPage.tsx:160` and is mapped into feed items at `src/pages/FeedPage.tsx:778`. | **Keep.** |
| `creator_id` | Yes. Used to load the creator's public profile at `src/pages/ProjectsPage.tsx:74`, filter network projects at `src/pages/ProjectsPage.tsx:220`, and render creator/team behavior at `src/pages/ProjectDetailPage.tsx:1233`. | **Keep.** Public creator attribution is a current product dependency. |
| `description` | Yes. Used in browse search at `src/pages/ProjectsPage.tsx:150`, cards at `src/pages/ProjectsPage.tsx:358`, and public detail at `src/pages/PublicCompanyProjectPage.tsx:78`. | **Keep.** |
| `end_date` | Yes. Displayed on the public company-project page at `src/pages/PublicCompanyProjectPage.tsx:71` and requested for open-role browsing at `src/components/projects/OpenRolesFeed.tsx:132`. | **Keep.** |
| `google_drive_url` | Yes, but only inside an `isMember` UI block at `src/pages/ProjectDetailPage.tsx:1417`; the link itself is rendered at `src/pages/ProjectDetailPage.tsx:1458`. Because `select('*')` returns it before that client-side check, every anonymous reader of a public project and every authenticated reader of any project can request the URL directly. | **Hide** from every public/general browse projection. Return it only through a member/creator-authorized query. |
| `header_image_url` | Yes. Used by directory cards at `src/pages/ProjectsPage.tsx:331`, feed mapping at `src/pages/FeedPage.tsx:787`, and public detail at `src/pages/PublicCompanyProjectPage.tsx:61`. | **Keep.** |
| `id` | Yes. Used as list identity, save target, and detail route fallback at `src/pages/ProjectsPage.tsx:293` and `src/lib/publicPaths.ts:26`. | **Keep.** |
| `is_public` | Yes, but not for public rendering. It is a query predicate for visitors (`src/pages/ProjectsPage.tsx:66`) and drives creator-only visibility controls on detail (`src/pages/ProjectDetailPage.tsx:782`). Filtering does not require returning it to anonymous clients. | **Hide** from the anonymous browse projection; keep it in a creator/admin projection. |
| `link_title` | Yes. Mapped into public feed items at `src/pages/FeedPage.tsx:792` and rendered on project detail at `src/pages/ProjectDetailPage.tsx:961`. | **Keep.** |
| `link_url` | Yes. Mapped into public feed items at `src/pages/FeedPage.tsx:791` and rendered on project detail at `src/pages/ProjectDetailPage.tsx:961`. | **Keep.** |
| `main_image_url` | Yes. Used as the fallback browse/detail image at `src/pages/ProjectsPage.tsx:338`, `src/pages/FeedPage.tsx:787`, and `src/pages/PublicCompanyProjectPage.tsx:61`. | **Keep.** |
| `post_approval_required` | No read-side runtime consumer found. The only non-generated runtime reference sets it during project creation (`src/components/feed/ProjectWizard.tsx:73`). | **Hide** from public/general browse projections; retain for the authorized posting workflow if that workflow begins reading it. |
| `slug` | Yes. The feed carries it into project URLs at `src/pages/FeedPage.tsx:782`, and `projectPath` prefers it at `src/lib/publicPaths.ts:26`. | **Keep.** |
| `start_date` | Yes. Displayed on the public company-project page at `src/pages/PublicCompanyProjectPage.tsx:71`. | **Keep.** |
| `status` | Yes. Separates active/archive browse views at `src/pages/ProjectsPage.tsx:178`, maps into feed items at `src/pages/FeedPage.tsx:778`, and drives the detail timeline at `src/pages/ProjectDetailPage.tsx:834`. | **Keep.** |
| `title` | Yes. Used for search/sort/cards at `src/pages/ProjectsPage.tsx:150` and displayed on both detail routes at `src/pages/ProjectDetailPage.tsx:779` and `src/pages/PublicCompanyProjectPage.tsx:69`. | **Keep.** |
| `updated_at` | No public or browse UI consumption found. | **Hide** from public/general browse projections. |

Recommended general browse column set: `category`, `created_at`, `creator_id`, `description`, `end_date`, `header_image_url`, `id`, `link_title`, `link_url`, `main_image_url`, `slug`, `start_date`, `status`, `title`. Hide `company_id`, `google_drive_url`, `is_public`, `post_approval_required`, and `updated_at` from the public/general browse payload. Of these, `google_drive_url` is the material confidentiality issue: the existing UI condition is not a database access boundary.

No view, RPC, query, schema, or policy was changed in Phase 2.5. These are documented projection requirements only.

## Phase 3 Group 4 - company browse identity lockdown

Status: **IMPLEMENTED LOCALLY; OWNER MANUAL VERIFICATION PASSED**

Implementation prepared in `20261002214500_inv96_group4_company_browse_privacy.sql`, with function volatility normalized by `20261002215500_inv96_group4_staff_context_volatility.sql`, public team identity handling tightened by `20261002223000_inv96_group4_public_team_privacy.sql`, anonymous team visibility removed by `20261002224500_inv96_group4_hide_team_from_anonymous.sql`, and unrelated signed-in visibility removed by `20261002230000_inv96_group4_restrict_team_to_managers.sql`:

- `companies` base reads are restricted to the owning user and admins.
- `company_photos` base reads are restricted to the owning company user and admins.
- `companies_browse` preserves public company presentation and exposes a caller-specific `is_owner` boolean without returning `owner_user_id`, `created_at`, or `updated_at`.
- `get_company_photos_browse(uuid)` preserves the public gallery while returning only `id`, `image_url`, and `caption`.
- Public company, company directory, and in-app company page reads move to the projection/RPC; owner/admin writes remain on the base tables.
- `get_company_management_context(uuid, text)` returns `owner_user_id` only to the owner, an admin, or a valid staff-token holder, preserving management and staff display without making the UUID public.
- `get_company_team_browse(uuid)` returns public display fields plus an opaque member key; it does not return account UUIDs or invitation email addresses.
- `get_company_team_member_browse(uuid, text)` preserves public team-member detail pages through the opaque key without returning an account UUID.
- Anonymous and unrelated authenticated callers receive no rows from either team RPC. Only the company owner and admins retain the presentation-only Team section and opaque member-detail route.
- `get_company_staff_access_managed(uuid, text)` returns staff invitation names and emails only to the company owner, an admin, or a valid staff-token holder.
- Anonymous and authenticated execution was revoked from the superseded `get_company_staff_ids(uuid)` and `get_company_staff_access_public(uuid)` identity-bearing RPCs.
- Local fixture company: `af4aba4a-3b05-4f48-b81b-4af6f9a8912e`.
- Local fixture photo: `1d4fc086-b765-42b3-b5f8-856a6588616d`.
- All five Group 4 migrations were applied to local Supabase only.
- Automated checks: TypeScript passed; 37 unit tests passed; sandbox build passed. Targeted ESLint remains blocked by 15 pre-existing violations in the company pages; none is on a Group 4 changed line.

### Owner-reported Group 4 verification

1. **PASS** - before implementation, anonymous and unrelated-user base-table reads exposed the fixture company owner UUID and photo uploader UUID; owner and admin reads returned the expected fixture rows.
2. **PASS** - after implementation, anonymous and unrelated-user base-table reads returned `[]` for both `companies` and `company_photos`; owner and admin reads returned the expected fixture rows.
3. **PASS** - `companies_browse` returned `is_owner=false` to anonymous, unrelated-user, and admin callers and `is_owner=true` to the owner, without an `owner_user_id` field.
4. **PASS** - `get_company_photos_browse` returned the fixture photo without `uploaded_by` or `company_id`.
5. **PASS** - `get_company_management_context` returned `[]` to anonymous and unrelated-user callers and returned the owner UUID to the owner and admin.
6. **PASS** - the unrelated user could view the company and photos without management or delete controls; the owner retained management, transfer, upload, and delete controls; the admin retained management controls; `/people` listed the company.
7. **PASS** - the owner uploaded an additional local test photo and received `Photo uploaded!`.
8. **PASS** - the signed-out public company route initially displayed the Team section through a raw UUID route. The first correction replaced raw identifiers with opaque member keys and removed public invitation-email access; owner REST checks returned `true` for the no-UUID/no-email assertion and both superseded RPCs returned HTTP `401` / PostgreSQL code `42501`. The owner then decided that signed-out visitors may not see Team names at all and confirmed that the anonymous Team call returns `[]`, the signed-out company route has no Team section, and the direct opaque staff route displays `Profile not available.` After observing that an unrelated signed-in user still saw the Team section, the owner chose owner/admin-only Team visibility. The owner confirmed that the unrelated user sees no Team section and receives `Profile not available.` from the opaque detail route, while both the owner and admin see the Team section and can open its detail page.

These are owner-executed and owner-confirmed results. Codex did not independently confirm the manual checks.

## Phase 3 Group 5 - project browse and member-detail privacy

Status: **IMPLEMENTED LOCALLY; OWNER MANUAL VERIFICATION PASSED**

Implementation prepared in `20261005163000_inv96_group5_project_browse_privacy.sql`, with anonymous helper execution isolated by `20261005164500_inv96_group5_guard_anonymous_browse_helpers.sql` and `20261005165000_inv96_group5_browse_access_helper.sql`:

- Anonymous users may discover public-project presentation fields through `projects_browse`, but `creator_id` is returned as `NULL` and member/workflow fields are omitted.
- The direct `/projects/:projectId` route now requires authentication.
- Authenticated users may read browse-safe base columns only for projects they can access. Direct client reads of `google_drive_url`, `company_id`, `is_public`, `post_approval_required`, and `updated_at` are revoked.
- `get_project_member_details(uuid)` returns those member/workflow fields only to the project creator, a project member, or an admin. Anonymous execution is revoked.
- `get_company_projects_browse(uuid)` and `get_company_project_browse(uuid, uuid)` preserve public company-project presentation without returning project creator or member-only fields.
- No project, membership, photo, role, link, or save fixture is inserted, updated, or deleted by these migrations.

### Confirmed access decisions

1. Signed-out visitors may see teaser-card title and image, but no creator name, avatar, or user ID.
2. Signed-out visitors must sign in before opening a project card or direct `/projects/:id` route.
3. A signed-in nonmember may open a public project and see creator attribution, but not its Drive URL.
4. The project owner and project members may open the project and retrieve the Drive URL through the member-authorized RPC.
5. Admins retain full project access.

### Frontend impact

- `src/App.tsx`: `/projects/:projectId` is wrapped in `RequireAuth`; without this change, a copied direct project URL would bypass the signed-out card gate.
- `src/pages/ProjectsPage.tsx`: browse and saved-project reads use `projects_browse`, and creator hydration is skipped when the anonymous projection returns no creator ID. Without this change, tightened base access would fail and signed-out cards could expose creator attribution.
- `src/pages/FeedPage.tsx`: general and group-linked project reads use `projects_browse`; creator hydration and badges require an authenticated caller-visible creator ID. Without this change, public feed reads would fail or continue exposing creator identity to signed-out visitors.
- `src/components/feed/FeedBentoCard.tsx` and `src/components/feed/FeedGridCard.tsx`: project cards omit the entire creator row when the browse projection does not expose a creator profile, rather than rendering an `Unknown` fallback avatar and label.
- `src/pages/ProjectDetailPage.tsx`: presentation fields come from `projects_browse`, while member-only fields come from `get_project_member_details`. Without this split, unrelated users could request the Drive URL directly or authorized members would lose it after the base-column revoke.
- `src/pages/MySavesPage.tsx`, `src/components/profile/SavedProjects.tsx`, `src/components/profile/UserPosts.tsx`, `src/components/scrollytelling.tsx`, `src/components/projects/OpenRolesFeed.tsx`, and `src/pages/ProfilePage.tsx`: project hydration/count reads use the browse projection. Without these changes, public or cross-user project cards and counts would fail under the tightened base policy.
- `src/pages/PublicCompanyPage.tsx`, `src/pages/CompanyProfilePage.tsx`, and `src/pages/PublicCompanyProjectPage.tsx`: company-linked presentation reads use the public-safe company project RPCs. Without these changes, signed-out company portfolios would fail after anonymous base-table access is removed.
- `src/integrations/supabase/types.ts`: adds the browse projection and RPC result contracts used by the updated frontend.
- `src/pages/tests/ProjectDetailPage.test.tsx`: the test double now models the browse-view plus member-detail RPC contract.

### Owner-reported pre-change baseline

1. `projects_browse` returned HTTP `404` / `PGRST205` because the view did not exist.
2. Anonymous and unrelated-user base-table reads returned the fixture's `google_drive_url` with HTTP `200`.
3. The owner was the only `project_members` row for the fixture; the unrelated account was not a project member.
4. The owner saw the project and Drive card; the unrelated user saw the public project without a Drive card.
5. Signed-out teaser cards displayed the creator name. Clicking a card requested sign-in, but opening a copied `/projects/:id` URL directly displayed the project without the Drive card.

These are owner-reported baseline observations. Codex did not independently confirm the manual checks.

### Automated implementation checks

- All three Group 5 migrations were applied to local Supabase at `http://127.0.0.1:54321`; no reset or hosted command was used.
- Anonymous `projects_browse` access returned the fixture with `creator_id=null` and without `google_drive_url`, `company_id`, `is_public`, `post_approval_required`, or `updated_at`.
- Anonymous direct selection of the base-table Drive URL returned HTTP `401` / PostgreSQL code `42501`.
- Local role simulation returned the public fixture to the unrelated user with the creator UUID but no member-detail row; the owner and admin each received the authorized member-detail row and Drive URL.
- Anonymous execution privilege on `get_project_member_details(uuid)` is absent, and authenticated direct column privilege on `projects.google_drive_url` is absent.
- `npm run typecheck`: passed.
- `npm run test:run`: passed (14 test files, 37 tests).
- `npm run build:sandbox`: passed with the existing Browserslist, Tailwind class-ambiguity, and bundle-size warnings.
- `git diff --check`: passed.
- No commit, push, hosted Supabase command, reset, or destructive database command was run for Group 5.

### Group 5 owner verification checklist

1. Confirm anonymous `projects_browse` returns `INV96 Public Project`, reports `creator_id=null`, and contains none of `google_drive_url`, `company_id`, `is_public`, `post_approval_required`, or `updated_at`.
2. Confirm anonymous and unrelated-user direct reads of `projects.google_drive_url` are rejected with HTTP `401` / PostgreSQL code `42501`.
3. Confirm the unrelated user can read the fixture from `projects_browse`, receives the owner UUID as `creator_id`, and receives no sensitive projection fields.
4. Confirm anonymous `get_project_member_details` execution is rejected, the unrelated user receives `[]`, and both owner and admin receive the fixture's member-detail row and recognizable Drive URL.
5. Signed out, confirm project teaser cards show title/image but no creator name, avatar, or user ID; clicking a card and opening `/projects/$PROJECT_ID` directly must require sign-in.
6. As the unrelated user, confirm the public project opens with creator attribution but no Drive card or URL.
7. As the owner, confirm the project opens and displays the recognizable Drive URL.
8. As the admin, confirm the project opens, the protected member-detail RPC succeeds, the Drive URL is displayed, and project data loads without database errors. Owner-only controls are not required.
9. Smoke-test saved projects, project profile cards, the public company portfolio/project pages, and open roles for missing cards or database errors.
10. Preserve the fixture and paste every REST response, missing field/card/control, browser error, console/network error, or unexpected identity disclosure back to Codex. Codex does not mark Group 5 verified.

### Owner-reported Group 5 verification

1. **PASS** - the working branch was `codex/inv96-rls-group5`.
2. **PASS** - anonymous `projects_browse` returned `INV96 Public Project` with `creator_id=null` and without `google_drive_url`, `company_id`, `is_public`, `post_approval_required`, or `updated_at`.
3. **PASS** - anonymous direct Drive selection was rejected with HTTP `401` / PostgreSQL code `42501`; unrelated authenticated direct selection was rejected with HTTP `403` / PostgreSQL code `42501`.
4. **PASS** - the unrelated authenticated browse projection returned the owner UUID as `creator_id` and contained no sensitive project fields.
5. **PASS** - anonymous `get_project_member_details` execution was rejected with HTTP `401`; the unrelated user received `[]`; owner and admin each received HTTP `200` with the recognizable Drive URL and protected member-detail fields.
6. **PASS** - signed-out project cards displayed title and image without creator name, avatar, UUID, or the `Unknown` fallback. Clicking a card or opening `/projects/:id` directly required sign-in and did not display project details.
7. **PASS** - the unrelated signed-in user opened the public project and saw `inv96.owner`, but no Google Drive card, recognizable Drive URL, or owner editing controls.
8. **PASS** - the owner saw the recognizable Drive URL and retained owner editing controls.
9. **PASS** - the admin page loaded without `Project not found` or a database-error toast; `get_project_member_details` returned HTTP `200` with the recognizable Drive URL; project title, creator, team, photos, links, and roles loaded without failed `4xx` or `5xx` requests. No mutation or owner-only control was required.
10. **PASS** - project cards loaded without database errors, and the project and membership fixtures were preserved.

These are owner-executed and owner-confirmed results. Codex did not independently confirm the manual checks.

## Phase 3 Group 6 - signed-in attribution browse views

Status: **IMPLEMENTED LOCALLY; OWNER MANUAL VERIFICATION PASSED**

Migration: `supabase/migrations/20261005180000_inv96_group6_public_attribution_views.sql`

### Policy and API changes

- `show_teammates`, `show_tips`, `studios`, `studio_posts`, and `studio_comments` no longer have literal-true or `PUBLIC` base-table policies.
- Existing insert, update, and delete behavior is preserved with the same ownership/admin predicates, but every write policy now explicitly targets `authenticated`.
- Base-table reads are limited to the relevant author, teammate/show submitter, or admin. `studios` base rows are admin-readable because catalog consumers now use the browse view.
- Added read-only `show_teammates_browse`, `show_tips_browse`, `studios_browse`, `studio_posts_browse`, and `studio_comments_browse` views for `authenticated` callers only.
- Browse views retain attribution `user_id` fields for signed-in product behavior. The owner clarified that teammates, tips, studios, studio posts, studio comments, and their attribution must not be available to signed-out callers.
- Follow-up migration `20261005183000_inv96_group6_require_auth_for_browse.sql` removes anonymous execution privileges after the revised owner decision.
- The migration includes manual rollback statements and does not insert, update, or delete any fixture row.

### Frontend impact

- `src/components/stage-whisper/ShowDetailSheet.tsx`: signed-in teammate and tip presentation reads use `show_teammates_browse` and `show_tips_browse`; those queries are disabled without a signed-in user. Tip creation remains on `show_tips`, and owner show editing remains on `show_teammates`.
- `src/components/insights/SchoolStudios.tsx`: signed-in studio, post, and comment reads use the three browse views; those queries are disabled without a signed-in user. Signed-in post and comment creation remains on the base tables.
- `src/App.tsx`: `/insights` is wrapped in `RequireAuth`, so signed-out visitors are redirected to sign-in rather than receiving an empty Insights shell.
- `src/pages/PeoplePage.tsx`, `src/pages/GroupMembersPage.tsx`, `src/pages/NetworkPieChartPage.tsx`, and `src/pages/ProfilePage.tsx`: studio catalog reads now use `studios_browse`.
- `src/pages/AdminPage.tsx`, `src/components/admin/BroadwayShowsManager.tsx`, and `src/components/admin/AffiliationRequestsManager.tsx` intentionally retain base-table reads/writes under admin policies.
- `src/integrations/supabase/types.ts`: adds the five browse-view result contracts.

### Owner-reported pre-change baseline

1. **PASS** - anonymous reads returned HTTP `200` JSON arrays from all five base tables.
2. **PASS** - the owner created public show `INV96 Group 6 Public Show` and added the unrelated account as a teammate; the product displayed `Your show has been added!`.
3. **PASS** - the owner created `INV96 Group 6 studio post`; the product displayed `Post created!`.
4. **PASS** - the unrelated user added `INV96 Group 6 studio comment`, which appeared with the unrelated user's attribution.
5. **PASS** - anonymous REST reads returned the teammate row, `INV96 verification tip`, Musical Theatre studio metadata, the owner-attributed studio post, and the unrelated-user-attributed studio comment.
6. The `/insights` route works directly but is not linked from the current desktop or mobile navigation. The older `NavigationWheel` contains an Industry Insights link but is not mounted. This is recorded as a separate product discoverability gap, not an RLS failure, and Group 6 does not change navigation.

Fixture IDs:

- Show: `068214d8-6b6a-4dfc-ae7b-ec9febd6368a`
- Studio: `f1774909-b1aa-4c31-a726-cc06c70d8289`
- Studio post: `020a1cc7-8031-47da-8257-2d3463375d02`
- Studio comment: `47464d3f-8c38-4a76-80b8-73515cb4ba89`
- Existing tip: `2144d50c-f2d5-4305-8d79-1aaa20b132d5`

These are owner-reported baseline observations. Codex did not independently confirm the manual checks.

### Automated implementation checks

- Applied `20261005180000_inv96_group6_public_attribution_views.sql` and follow-up `20261005183000_inv96_group6_require_auth_for_browse.sql` to local Supabase; no reset or hosted command was used.
- Catalog inspection found 18 Group 6 policies, all explicitly assigned to `authenticated`; no literal-true base-table read policy remains.
- Initial grant inspection found `SELECT` for `anon` and `authenticated` on each browse view. After owner clarification, local grant inspection confirmed the follow-up migration removed anonymous privileges and retained `SELECT` only for `authenticated`.
- Every named fixture remains present exactly once.
- Before the revised owner decision, local anonymous REST checks returned HTTP `200` arrays from all five browse views. After the follow-up migration, all five anonymous REST requests returned HTTP `401` / PostgreSQL code `42501` and no fixture data.
- Initial local role simulation returned all five browse fixtures to every caller. The revised result removes anonymous browse access, while service-role fixture checks confirmed every fixture remains present exactly once. Owner manual verification must reconfirm signed-in browse behavior. Base-table isolation remains unchanged: the unrelated user receives only the teammate and own-comment rows; the owner receives the submitted teammate, owned tip, and owned post rows; the admin receives every base fixture.
- `npm run typecheck`: passed.
- `npm run test:run`: passed (14 test files, 37 tests).
- `npm run build:sandbox`: passed with the existing Browserslist, Tailwind class-ambiguity, and bundle-size warnings.
- `git diff --check`: passed.
- No commit, push, hosted Supabase command, reset, or destructive database command was run for Group 6.

### Group 6 owner verification checklist

1. Confirm all five anonymous browse endpoint requests are rejected with HTTP `401` and no fixture data.
2. Confirm anonymous base-table reads return `[]` for all five fixture filters.
3. Confirm the unrelated user receives only the teammate and own-comment base rows, while the owner receives the submitted teammate, owned tip, and owned studio post base rows.
4. In local Studio under Authentication -> Policies, confirm every Group 6 policy targets `authenticated`, no `SELECT USING (true)` remains, and write predicates retain their owner/admin checks.
5. Signed out, open `/insights` directly and confirm the route requires sign-in and no Insights content displays. Open `/industry-now` and confirm no teammate, tip, or related attribution data displays.
6. Signed in as the unrelated user, confirm Musical Theatre studio content displays, then open `/industry-now`, find `INV96 Group 6 Public Show`, and confirm teammate attribution and `INV96 verification tip` remain visible.
7. Signed in as the owner, add a new verification tip and studio post; signed in as the unrelated user, add a comment to that post. Confirm each action succeeds and attribution displays. Preserve the new fixtures.
8. Confirm the admin studio-post manager and Broadway show-tip manager load without database errors. Do not delete anything.
9. Paste all REST responses, policy screenshots/results, product PASS/FAIL outcomes, missing attribution, and console/network errors back to Codex. Codex does not mark Group 6 verified.

### Owner-reported manual verification results

1. **PASS** - anonymous requests to all five browse views returned HTTP `401` with `permission denied`; no teammate, tip, studio, post, comment, or attribution data was returned.
2. **PASS** - anonymous base-table reads returned `[]` for all five fixture filters.
3. **PASS** - base-table isolation matched the intended predicates: the unrelated user received only the teammate and own-comment rows; the owner received the submitted teammate, owned tip, and owned studio post rows; the admin received all five fixture rows.
4. **PASS** - local Studio showed every Group 6 policy targeting `authenticated` for `show_teammates`, `show_tips`, `studios`, `studio_posts`, and `studio_comments`.
5. **PASS** - signed-out `/insights` redirected to `/auth`, and a fresh signed-out session displayed no Group 6 teammate, tip, studio, post, comment, or attribution data.
6. **PASS** - signed in as the unrelated user, Musical Theatre displayed the Group 6 studio post and comment with attribution; `INV96 Group 6 Public Show` displayed `inv96.other` as a teammate; `INV96 verification tip` and the post-change tip displayed with owner attribution.
7. **PASS** - the owner created the post-change tip and studio post; the unrelated user created `INV96 Group 6 post-change studio comment`, which appeared with `inv96.other` attribution.
8. **PASS** - the admin show-tip and studio-post managers loaded without database errors and displayed the new records.
9. All fixtures were preserved. These results were executed and confirmed by the owner; Codex did not independently confirm the browser checks.

## Base comparison

- Preserved survey: `rls-review-sep22-base.md`, base `fe33c38de6db499ae5b29cf96a85a960fda826c4`.
- Fresh survey: this file, base `21f034010c15ad2f61c2051b1520a7e2f5601367`.
- Git change between bases: eight lines added to `supabase/functions/send-notification-email/index.ts` for the `NOTIFICATION_EMAILS_ENABLED` kill-switch; no migration or schema files changed.
- The clean reset has 70 tables versus 77 in the preserved survey. The seven tables present only in the prior local database are `event_groups`, `group_audition_signups`, `group_audition_timeslots`, `group_auditions`, `group_invites`, `group_resources`, and `project_recipients`.
- Three removals are explained by untracked September 21 migrations in the original checkout: `group_auditions`, `group_audition_timeslots`, and `group_audition_signups`. The other four removed tables (`event_groups`, `group_invites`, `group_resources`, and `project_recipients`) have no creating migration in either Git base or the original checkout's current migration files; their presence in the prior local database was schema drift whose exact source is not recoverable from this repository. None of the seven appears after resetting solely from `21f0340`.
- Effective policies changed from 281 to 257. Besides removal of those seven tables, policy sets differ for `event_rsvps` (10 to 9), `group_members` (4 to 5), `projects` (8 to 10), and `tickets` (5 to 4). The policy counts stay constant but definitions differ for `groups`, `post_groups`, and `project_groups`.
- Literal-true tables changed from 20 to 22 because the clean tracked migration state exposes literal-true SELECT policies on `groups` and `projects`.

## Table index

| Table | RLS | Policies | Direct reads | Direct writes |
| --- | --- | ---: | ---: | ---: |
| `affiliation_requests` | enabled | 3 | 2 | 2 |
| `analytics_events` | enabled | 2 | 0 | 1 |
| `broadway_metrics` | enabled | 4 | 1 | 0 |
| `companies` | enabled | 5 | 5 | 3 |
| `company_account_requests` | enabled | 5 | 4 | 4 |
| `company_follows` | enabled | 3 | 2 | 2 |
| `company_photos` | enabled | 4 | 2 | 2 |
| `company_staff_access` | enabled | 2 | 1 | 0 |
| `connection_requests` | enabled | 4 | 2 | 6 |
| `connections` | enabled | 3 | 2 | 2 |
| `credit_verification_requests` | enabled | 4 | 3 | 4 |
| `credit_vouches` | enabled | 3 | 1 | 2 |
| `credits` | enabled | 5 | 3 | 7 |
| `event_panelists` | enabled | 2 | 3 | 4 |
| `event_recipients` | enabled | 3 | 0 | 1 |
| `event_rsvps` | enabled | 9 | 3 | 3 |
| `events` | enabled | 6 | 16 | 5 |
| `film_metrics` | enabled | 4 | 6 | 3 |
| `group_admins` | enabled | 1 | 1 | 0 |
| `group_chat_members` | enabled | 1 | 2 | 1 |
| `group_chat_messages` | enabled | 0 | 3 | 2 |
| `group_members` | enabled | 5 | 2 | 4 |
| `groups` | enabled | 2 | 1 | 0 |
| `industry_highlights` | enabled | 4 | 2 | 3 |
| `job_post_credits` | enabled | 1 | 2 | 1 |
| `messages` | enabled | 4 | 3 | 6 |
| `notifications` | enabled | 3 | 1 | 4 |
| `nyc_shows` | enabled | 7 | 8 | 7 |
| `opportunities` | enabled | 6 | 7 | 3 |
| `opportunity_applications` | enabled | 5 | 3 | 2 |
| `platform_invites` | enabled | 1 | 1 | 0 |
| `post_comments` | enabled | 3 | 2 | 2 |
| `post_groups` | enabled | 3 | 3 | 1 |
| `post_recipients` | enabled | 3 | 0 | 2 |
| `posts` | enabled | 5 | 12 | 7 |
| `profile_flipbook` | enabled | 4 | 0 | 0 |
| `profile_views` | enabled | 1 | 2 | 1 |
| `profiles` | enabled | 4 | 26 | 14 |
| `project_credit_invites` | enabled | 1 | 1 | 0 |
| `project_group_chats` | enabled | 1 | 1 | 2 |
| `project_groups` | enabled | 3 | 1 | 1 |
| `project_invitations` | enabled | 3 | 3 | 6 |
| `project_links` | enabled | 4 | 1 | 3 |
| `project_members` | enabled | 4 | 10 | 7 |
| `project_photos` | enabled | 3 | 2 | 2 |
| `project_roles` | enabled | 5 | 17 | 6 |
| `projects` | enabled | 10 | 31 | 14 |
| `resources` | enabled | 4 | 2 | 4 |
| `role_applications` | enabled | 4 | 4 | 4 |
| `saved_films` | enabled | 3 | 1 | 3 |
| `saved_items` | enabled | 3 | 1 | 2 |
| `saved_projects` | enabled | 3 | 8 | 8 |
| `saved_shows` | enabled | 4 | 3 | 2 |
| `show_reminders` | enabled | 4 | 0 | 0 |
| `show_teammates` | enabled | 4 | 2 | 3 |
| `show_tips` | enabled | 4 | 2 | 3 |
| `showcase_profiles` | enabled | 5 | 5 | 4 |
| `showcase_programs` | enabled | 2 | 2 | 0 |
| `streaming_content` | enabled | 4 | 1 | 3 |
| `studio_comments` | enabled | 3 | 1 | 1 |
| `studio_posts` | enabled | 5 | 2 | 2 |
| `studios` | enabled | 2 | 5 | 1 |
| `tickets` | enabled | 4 | 14 | 14 |
| `tip_votes` | enabled | 3 | 1 | 2 |
| `user_engagement` | enabled | 3 | 2 | 2 |
| `user_films` | enabled | 7 | 2 | 1 |
| `user_media` | enabled | 5 | 5 | 6 |
| `user_music_shows` | enabled | 7 | 3 | 5 |
| `user_roles` | enabled | 3 | 2 | 0 |
| `vouches` | enabled | 3 | 1 | 2 |

## Detailed inventory

### `public.affiliation_requests`

- RLS: **enabled**
- Direct reads: `src/components/admin/AffiliationRequestsManager.tsx:53`, `src/pages/ProfilePage.tsx:1091`
- Direct writes: `src/components/admin/AffiliationRequestsManager.tsx:99`, `src/pages/ProfilePage.tsx:1100`
- Policies: **3**
  - **Admins can update affiliation requests** — command `UPDATE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Users can create their own affiliation requests** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can view their own affiliation requests** — command `SELECT`; roles `authenticated`; USING `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK none

### `public.analytics_events`

- RLS: **enabled**
- Direct reads: none found
- Direct writes: `supabase/functions/track-analytics-event/index.ts:63`
- Policies: **2**
  - **Admins can view analytics** — command `SELECT`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can view analytics events** — command `SELECT`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none

### `public.broadway_metrics`

- RLS: **enabled**
- Direct reads: `src/components/insights/IndustryMetrics.tsx:79`
- Direct writes: none found
- Policies: **4**
  - **Admins can delete broadway metrics** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert broadway metrics** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update broadway metrics** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Broadway metrics are publicly readable** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.companies`

- RLS: **enabled**
- Direct reads: `src/components/admin/CompanyRequestsManager.tsx:151`, `src/components/admin/EventsManager.tsx:495`, `src/hooks/useCompanyFollows.ts:31`, `src/pages/CompanyProfilePage.tsx:940`, `src/pages/PublicCompanyPage.tsx:17`
- Direct writes: `src/components/admin/CompanyRequestsManager.tsx:319`, `src/pages/CompanyProfilePage.tsx:145`, `src/pages/CompanyProfilePage.tsx:390`
- Policies: **5**
  - **Admins can delete companies** — command `DELETE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert companies** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update companies** — command `UPDATE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Companies are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Company owners can update their company** — command `UPDATE`; roles `authenticated`; USING `(auth.uid() = owner_user_id)`; WITH CHECK `(auth.uid() = owner_user_id)`

### `public.company_account_requests`

- RLS: **enabled**
- Direct reads: `src/components/admin/CompanyRequestsManager.tsx:129`, `src/components/profile/RequestCompanyAccountDialog.tsx:95`, `supabase/functions/approve-company-account/index.ts:137`, `supabase/functions/deny-company-account/index.ts:128`
- Direct writes: `src/components/admin/CompanyRequestsManager.tsx:338`, `src/components/profile/RequestCompanyAccountDialog.tsx:125`, `src/components/profile/RequestCompanyAccountDialog.tsx:131`, `supabase/functions/deny-company-account/index.ts:146`
- Policies: **5**
  - **Admins can delete reviewed company requests** — command `DELETE`; roles `authenticated`; USING `(has_role(auth.uid(), 'admin'::app_role) AND (status <> 'pending'::text))`; WITH CHECK none
  - **Admins can update company requests** — command `UPDATE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Users can create their own company requests** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `(auth.uid() = requester_id)`
  - **Users can update their own pending company requests** — command `UPDATE`; roles `authenticated`; USING `((auth.uid() = requester_id) AND (status = 'pending'::text))`; WITH CHECK `((auth.uid() = requester_id) AND (status = 'pending'::text))`
  - **Users can view their own company requests** — command `SELECT`; roles `authenticated`; USING `((auth.uid() = requester_id) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK none

### `public.company_follows`

- RLS: **enabled**
- Direct reads: `src/hooks/useCompanyFollows.ts:44`, `src/pages/CompanyProfilePage.tsx:950`
- Direct writes: `src/hooks/useCompanyFollows.ts:57`, `src/hooks/useCompanyFollows.ts:70`
- Policies: **3**
  - **Users can follow companies** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can unfollow companies** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their own follows** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.company_photos`

- RLS: **enabled**
- Direct reads: `src/pages/CompanyProfilePage.tsx:997`, `src/pages/PublicCompanyPage.tsx:45`
- Direct writes: `src/pages/CompanyProfilePage.tsx:1056`, `src/pages/CompanyProfilePage.tsx:1078`
- Policies: **4**
  - **Admins can manage company photos** — command `ALL`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Anyone can view company photos** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Company owner can delete photos** — command `DELETE`; roles `PUBLIC`; USING `(EXISTS ( SELECT 1 FROM companies WHERE ((companies.id = company_photos.company_id) AND (companies.owner_user_id = auth.uid()))))`; WITH CHECK none
  - **Company owner can insert photos** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(EXISTS ( SELECT 1 FROM companies WHERE ((companies.id = company_photos.company_id) AND (companies.owner_user_id = auth.uid()))))`

### `public.company_staff_access`

- RLS: **enabled**
- Direct reads: `src/components/admin/CompanyRequestsManager.tsx:163`
- Direct writes: none found
- Policies: **2**
  - **Admins and owners can manage company staff access** — command `UPDATE`; roles `authenticated`; USING `(has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = company_staff_access.company_id) AND (c.owner_user_id = auth.uid())))))`; WITH CHECK `(has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = company_staff_access.company_id) AND (c.owner_user_id = auth.uid())))))`
  - **Admins and owners can view company staff access** — command `SELECT`; roles `authenticated`; USING `(has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = company_staff_access.company_id) AND (c.owner_user_id = auth.uid())))))`; WITH CHECK none

### `public.connection_requests`

- RLS: **enabled**
- Direct reads: `src/hooks/useConnectionRequests.ts:24`, `src/hooks/useConnectionRequests.ts:52`
- Direct writes: `src/hooks/useConnectionRequests.ts:105`, `src/hooks/useConnectionRequests.ts:122`, `src/hooks/useConnectionRequests.ts:141`, `src/hooks/useConnectionRequests.ts:157`, `src/hooks/useConnectionRequests.ts:81`, `src/hooks/useConnectionRequests.ts:97`
- Policies: **4**
  - **Users can cancel their sent requests** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = sender_id)`; WITH CHECK none
  - **Users can respond to received requests** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = receiver_id)`; WITH CHECK none
  - **Users can send connection requests** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = sender_id)`
  - **Users can view their connection requests** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))`; WITH CHECK none

### `public.connections`

- RLS: **enabled**
- Direct reads: `src/hooks/useNetworkConnections.ts:57`, `src/hooks/useNetworkConnections.ts:72`
- Direct writes: `src/hooks/useNetworkConnections.ts:101`, `src/hooks/useNetworkConnections.ts:86`
- Policies: **3**
  - **Users can follow others** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = follower_id)`
  - **Users can unfollow** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = follower_id)`; WITH CHECK none
  - **Visible connections are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `(profile_is_visible_to_current_user(follower_id) AND profile_is_visible_to_current_user(following_id))`; WITH CHECK none

### `public.credit_verification_requests`

- RLS: **enabled**
- Direct reads: `src/hooks/useCreditVerification.ts:113`, `src/hooks/useCreditVerification.ts:182`, `src/hooks/useCreditVerification.ts:201`
- Direct writes: `src/hooks/useCreditVerification.ts:128`, `src/hooks/useCreditVerification.ts:151`, `src/hooks/useCreditVerification.ts:210`, `src/hooks/useCreditVerification.ts:246`
- Policies: **4**
  - **Admins can update verification requests** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Users can create verification requests** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can delete pending requests** — command `DELETE`; roles `PUBLIC`; USING `((auth.uid() = user_id) AND (status = 'pending'::text))`; WITH CHECK none
  - **Users can view their own requests** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK none

### `public.credit_vouches`

- RLS: **enabled**
- Direct reads: `src/hooks/useCreditVerification.ts:37`
- Direct writes: `src/hooks/useCreditVerification.ts:55`, `src/hooks/useCreditVerification.ts:78`
- Policies: **3**
  - **Anyone can view credit vouches** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Authenticated users can vouch** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = voucher_id)`
  - **Users can remove their vouch** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = voucher_id)`; WITH CHECK none

### `public.credits`

- RLS: **enabled**
- Direct reads: `src/lib/projectInvitationCredits.ts:24`, `src/pages/ProfilePage.tsx:481`, `src/pages/ProfilePage.tsx:561`
- Direct writes: `src/hooks/useCreditVerification.ts:223`, `src/lib/projectInvitationCredits.ts:37`, `src/lib/projectInvitationCredits.ts:45`, `src/pages/ProfilePage.tsx:1182`, `src/pages/ProfilePage.tsx:1209`, `src/pages/ProfilePage.tsx:1225`, `src/pages/ProjectNewPage.tsx:106`
- Policies: **5**
  - **Admins can update credits for verification** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Credits are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own credits** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can insert their own credits** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can update their own credits** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.event_panelists`

- RLS: **enabled**
- Direct reads: `src/components/admin/EventsManager.tsx:461`, `src/components/feed/FeedItem.tsx:164`, `src/pages/PublicEventPanelistPage.tsx:77`
- Direct writes: `src/components/admin/EventsManager.tsx:610`, `src/components/admin/EventsManager.tsx:611`, `src/components/admin/EventsManager.tsx:630`, `src/components/admin/EventsManager.tsx:647`
- Policies: **2**
  - **Active event panelists are publicly readable** — command `SELECT`; roles `anon, authenticated`; USING `(is_active IS TRUE)`; WITH CHECK none
  - **Admins can manage event panelists** — command `ALL`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`

### `public.event_recipients`

- RLS: **enabled**
- Direct reads: none found
- Direct writes: `src/components/feed/PostCreator.tsx:266`
- Policies: **3**
  - **Event owner and recipients can view** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = recipient_id) OR (auth.uid() IN ( SELECT events.user_id FROM events WHERE (events.id = event_recipients.event_id))))`; WITH CHECK none
  - **Event owner can delete recipients** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() IN ( SELECT events.user_id FROM events WHERE (events.id = event_recipients.event_id)))`; WITH CHECK none
  - **Event owner can insert recipients** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() IN ( SELECT events.user_id FROM events WHERE (events.id = event_recipients.event_id)))`

### `public.event_rsvps`

- RLS: **enabled**
- Direct reads: `src/components/admin/EventsManager.tsx:192`, `src/components/profile/AddAttendedDialog.tsx:93`, `src/hooks/useEventRsvps.ts:33`
- Direct writes: `src/components/profile/AddAttendedDialog.tsx:103`, `src/components/profile/AddAttendedDialog.tsx:110`, `src/pages/EventDashboardPage.tsx:405`
- Policies: **9**
  - **Admins can view all RSVPs** — command `SELECT`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Authenticated users can RSVP** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `((auth.uid() = user_id) AND (event_id IS NOT NULL) AND (NULLIF(btrim(name), ''::text) IS NOT NULL) AND (NULLIF(btrim(email), ''::text) IS NOT NULL) AND (NULLIF(btrim(role_type), ''::text) IS NOT NULL) AND (status = ANY (ARRAY['going'::text, 'cant_make_it'::text])) AND ((EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_rsvps.event_id) AND (e.event_date >= now())))) OR (attended IS TRUE)))`
  - **Event creators and admins can view RSVPs for their events** — command `SELECT`; roles `authenticated`; USING `((auth.uid() IN ( SELECT events.user_id FROM events WHERE (events.id = event_rsvps.event_id))) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK none
  - **Event creators can update RSVPs for their events** — command `UPDATE`; roles `authenticated`; USING `(EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_rsvps.event_id) AND (e.user_id = auth.uid()))))`; WITH CHECK `(EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_rsvps.event_id) AND (e.user_id = auth.uid()))))`
  - **Event creators can view RSVPs for their events** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() IN ( SELECT events.user_id FROM events WHERE (events.id = event_rsvps.event_id)))`; WITH CHECK none
  - **Users can delete their own RSVP** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their own RSVP** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK `((auth.uid() = user_id) AND ((EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_rsvps.event_id) AND (e.event_date >= now())))) OR (attended IS TRUE)))`
  - **Users can view their own RSVP** — command `SELECT`; roles `authenticated`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their own RSVPs** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.events`

- RLS: **enabled**
- Direct reads: `src/components/admin/EventsManager.tsx:122`, `src/components/profile/AddAttendedDialog.tsx:51`, `src/components/profile/UserPosts.tsx:35`, `src/components/scrollytelling.tsx:141`, `src/components/scrollytelling.tsx:148`, `src/pages/EventDashboardPage.tsx:143`, `src/pages/EventDashboardPage.tsx:153`, `src/pages/EventDashboardPage.tsx:167`, `src/pages/FeedPage.tsx:536`, `src/pages/FeedPage.tsx:565`, `src/pages/MyTicketsPage.tsx:87`, `src/pages/ProfilePage.tsx:569`, `src/pages/PublicEventPanelistPage.tsx:94`, `supabase/functions/create-event-price/index.ts:50`, `supabase/functions/create-ticket-checkout/index.ts:81`, `supabase/functions/send-ticket-email/index.ts:82`
- Direct writes: `src/components/admin/EventsManager.tsx:347`, `src/components/feed/EditPostDialog.tsx:195`, `src/components/feed/FeedItem.tsx:346`, `src/components/feed/PostCreator.tsx:63`, `supabase/functions/create-event-price/index.ts:88`
- Policies: **6**
  - **Admins can delete any event** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can update any event** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Events are viewable based on visibility** — command `SELECT`; roles `PUBLIC`; USING `can_view_event(events.*)`; WITH CHECK none
  - **Users can create their own events** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can delete their own events** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their own events** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.film_metrics`

- RLS: **enabled**
- Direct reads: `src/components/admin/FilmContentManager.tsx:82`, `src/components/insights/IndustryMetrics.tsx:64`, `src/components/messages/GroupChatThread.tsx:56`, `src/pages/MessagesPage.tsx:64`, `src/pages/MySavesPage.tsx:288`, `src/pages/StageWhisperPage.tsx:161`
- Direct writes: `src/components/admin/FilmContentManager.tsx:110`, `src/components/admin/FilmContentManager.tsx:132`, `src/components/admin/FilmContentManager.tsx:152`
- Policies: **4**
  - **Admins can delete film metrics** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert film metrics** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update film metrics** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Film metrics are publicly readable** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.group_admins`

- RLS: **enabled**
- Direct reads: `src/pages/GroupPage.tsx:132`
- Direct writes: none found
- Policies: **1**
  - **Group admins can view group admins** — command `SELECT`; roles `PUBLIC`; USING `(is_group_faculty(auth.uid(), group_id) OR (user_id = auth.uid()))`; WITH CHECK none

### `public.group_chat_members`

- RLS: **enabled**
- Direct reads: `src/components/messages/NewGroupMessageDialog.tsx:53`, `src/hooks/useGroupChats.ts:45`
- Direct writes: `src/components/messages/NewGroupMessageDialog.tsx:102`
- Policies: **1**
  - **Users can view their group memberships** — command `SELECT`; roles `PUBLIC`; USING `(user_id = auth.uid())`; WITH CHECK none

### `public.group_chat_messages`

- RLS: **enabled**
- Direct reads: `src/hooks/useGroupChats.ts:129`, `src/hooks/useGroupChats.ts:160`, `src/hooks/useGroupChats.ts:66`
- Direct writes: `src/hooks/useGroupChats.ts:160`, `src/pages/MySavesPage.tsx:125`
- Policies: **0**
  - none

### `public.group_members`

- RLS: **enabled**
- Direct reads: `src/pages/GroupPage.tsx:160`, `src/pages/GroupPage.tsx:89`
- Direct writes: `src/pages/GroupPage.tsx:103`, `src/pages/GroupPage.tsx:254`, `src/pages/GroupPage.tsx:263`, `src/pages/GroupPage.tsx:290`
- Policies: **5**
  - **Faculty can add members** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `is_group_faculty(auth.uid(), group_id)`
  - **Faculty can update memberships** — command `UPDATE`; roles `PUBLIC`; USING `is_group_faculty(auth.uid(), group_id)`; WITH CHECK `is_group_faculty(auth.uid(), group_id)`
  - **Faculty or user can remove membership** — command `DELETE`; roles `PUBLIC`; USING `((user_id = auth.uid()) OR is_group_faculty(auth.uid(), group_id))`; WITH CHECK none
  - **Members can view roster of their group** — command `SELECT`; roles `PUBLIC`; USING `((user_id = auth.uid()) OR is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id))`; WITH CHECK none
  - **Users can request to join** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((user_id = auth.uid()) AND (status = 'pending'::text))`

### `public.groups`

- RLS: **enabled**
- Direct reads: `src/hooks/useGroups.ts:43`
- Direct writes: none found
- Policies: **2**
  - **Group admins can update group** — command `UPDATE`; roles `PUBLIC`; USING `is_group_faculty(auth.uid(), id)`; WITH CHECK `is_group_faculty(auth.uid(), id)`
  - **Groups readable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.industry_highlights`

- RLS: **enabled**
- Direct reads: `src/components/insights/IndustryMetrics.tsx:94`, `src/pages/AdminPage.tsx:447`
- Direct writes: `src/pages/AdminPage.tsx:457`, `src/pages/AdminPage.tsx:472`, `src/pages/AdminPage.tsx:487`
- Policies: **4**
  - **Admins can delete highlights** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert highlights** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update highlights** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Industry highlights are publicly readable** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.job_post_credits`

- RLS: **enabled**
- Direct reads: `src/pages/OpportunitiesPage.tsx:513`, `supabase/functions/stripe-webhook/index.ts:205`
- Direct writes: `supabase/functions/stripe-webhook/index.ts:212`
- Policies: **1**
  - **Users can view their own job credits** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.messages`

- RLS: **enabled**
- Direct reads: `src/hooks/useMessages.ts:103`, `src/hooks/useMessages.ts:126`, `src/hooks/useMessages.ts:35`
- Direct writes: `src/components/feed/FeedItem.tsx:1118`, `src/components/projects/OpenRolesDisplay.tsx:345`, `src/hooks/useMessages.ts:126`, `src/hooks/useMessages.ts:150`, `src/pages/MySavesPage.tsx:107`, `src/pages/OpportunitiesPage.tsx:117`
- Policies: **4**
  - **Users can delete their sent messages** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = sender_id)`; WITH CHECK none
  - **Users can mark messages as read** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = receiver_id)`; WITH CHECK none
  - **Users can send messages** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = sender_id)`
  - **Users can view their own messages** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))`; WITH CHECK none

### `public.notifications`

- RLS: **enabled**
- Direct reads: `src/hooks/useNotifications.ts:28`
- Direct writes: `src/hooks/useNotifications.ts:104`, `src/hooks/useNotifications.ts:50`, `src/hooks/useNotifications.ts:68`, `src/hooks/useNotifications.ts:86`
- Policies: **3**
  - **Users can delete their notifications** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their notifications** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their own notifications** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.nyc_shows`

- RLS: **enabled**
- Direct reads: `src/components/admin/BroadwayShowsManager.tsx:73`, `src/components/messages/GroupChatThread.tsx:46`, `src/components/profile/AddAttendedDialog.tsx:66`, `src/components/stage-whisper/AddShowDialog.tsx:184`, `src/components/stage-whisper/MyShowList.tsx:45`, `src/pages/MessagesPage.tsx:54`, `src/pages/MySavesPage.tsx:273`, `src/pages/StageWhisperPage.tsx:143`
- Direct writes: `src/components/admin/BroadwayShowsManager.tsx:117`, `src/components/admin/BroadwayShowsManager.tsx:139`, `src/components/admin/BroadwayShowsManager.tsx:155`, `src/components/feed/FeedItem.tsx:350`, `src/components/stage-whisper/AddShowDialog.tsx:184`, `src/components/stage-whisper/AddShowDialog.tsx:212`, `src/components/stage-whisper/EditShowDialog.tsx:232`
- Policies: **7**
  - **Admins can delete any show** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert any show** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update any show** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Shows are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own shows** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = submitted_by)`; WITH CHECK none
  - **Users can submit off-off-broadway or school shows** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((auth.uid() IS NOT NULL) AND (submitted_by = auth.uid()) AND (category = ANY (ARRAY['off-off-broadway'::text, 'school'::text])))`
  - **Users can update their own shows** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = submitted_by)`; WITH CHECK `((auth.uid() = submitted_by) AND (category = ANY (ARRAY['off-off-broadway'::text, 'school'::text])))`

### `public.opportunities`

- RLS: **enabled**
- Direct reads: `src/components/messages/GroupChatThread.tsx:66`, `src/hooks/useOpportunities.ts:218`, `src/hooks/useOpportunities.ts:447`, `src/pages/MessagesPage.tsx:74`, `src/pages/MySavesPage.tsx:308`, `src/pages/MySavesPage.tsx:836`, `src/pages/MySavesPage.tsx:840`
- Direct writes: `src/hooks/useOpportunities.ts:337`, `src/hooks/useOpportunities.ts:402`, `src/hooks/useOpportunities.ts:447`
- Policies: **6**
  - **Admins can manage all opportunities** — command `ALL`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Authenticated users can view opportunities** — command `SELECT`; roles `authenticated`; USING `true`; WITH CHECK none
  - **Public opportunities are viewable by visitors** — command `SELECT`; roles `anon`; USING `COALESCE(is_public, false)`; WITH CHECK none
  - **Users can create opportunities** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = posted_by)`
  - **Users can delete their own opportunities** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = posted_by)`; WITH CHECK none
  - **Users can update their own opportunities** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = posted_by)`; WITH CHECK none

### `public.opportunity_applications`

- RLS: **enabled**
- Direct reads: `src/components/opportunities/OpportunityCard.tsx:106`, `src/pages/OpportunitiesPage.tsx:697`, `src/pages/OpportunitiesPage.tsx:803`
- Direct writes: `src/components/opportunities/ApplicationDialog.tsx:140`, `src/pages/OpportunitiesPage.tsx:101`
- Policies: **5**
  - **Opportunity posters can view received applications** — command `SELECT`; roles `PUBLIC`; USING `(EXISTS ( SELECT 1 FROM opportunities o WHERE (((o.id)::text = opportunity_applications.opportunity_id) AND (o.posted_by = auth.uid()))))`; WITH CHECK none
  - **Users can submit applications** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = applicant_id)`
  - **Users can update pending applications** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid() = applicant_id) AND (status = 'pending'::text))`; WITH CHECK none
  - **Users can view their own applications** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = applicant_id)`; WITH CHECK none
  - **Users can withdraw applications** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = applicant_id)`; WITH CHECK none

### `public.platform_invites`

- RLS: **enabled**
- Direct reads: `src/pages/AdminPage.tsx:274`
- Direct writes: none found
- Policies: **1**
  - **Platform inviters can view their invites** — command `SELECT`; roles `authenticated`; USING `((inviter_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK none

### `public.post_comments`

- RLS: **enabled**
- Direct reads: `src/hooks/usePostComments.ts:33`, `src/hooks/usePostComments.ts:51`
- Direct writes: `src/components/feed/PostComments.tsx:71`, `src/components/feed/PostComments.tsx:86`
- Policies: **3**
  - **Author or moderators can delete comment** — command `DELETE`; roles `authenticated`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM posts p WHERE ((p.id = post_comments.post_id) AND (p.user_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1 FROM post_groups pg WHERE ((pg.post_id = post_comments.post_id) AND is_group_faculty(auth.uid(), pg.group_id)))))`; WITH CHECK none
  - **Comments visible to users who can view the parent post** — command `SELECT`; roles `PUBLIC`; USING `(EXISTS ( SELECT 1 FROM posts p WHERE ((p.id = post_comments.post_id) AND can_view_post(p.*))))`; WITH CHECK none
  - **Users can comment on posts they can view** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM posts p WHERE ((p.id = post_comments.post_id) AND can_view_post(p.*)))))`

### `public.post_groups`

- RLS: **enabled**
- Direct reads: `src/components/feed/PostComments.tsx:46`, `src/pages/FeedPage.tsx:348`, `src/pages/GroupPage.tsx:185`
- Direct writes: `src/pages/GroupPage.tsx:218`
- Policies: **3**
  - **Members can read post-group links** — command `SELECT`; roles `PUBLIC`; USING `(is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id))`; WITH CHECK none
  - **Owner can tag own post to a group they belong to** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((EXISTS ( SELECT 1 FROM posts p WHERE ((p.id = post_groups.post_id) AND (p.user_id = auth.uid())))) AND (is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id)))`
  - **Owner or faculty can untag post** — command `DELETE`; roles `PUBLIC`; USING `((EXISTS ( SELECT 1 FROM posts p WHERE ((p.id = post_groups.post_id) AND (p.user_id = auth.uid())))) OR is_group_faculty(auth.uid(), group_id))`; WITH CHECK none

### `public.post_recipients`

- RLS: **enabled**
- Direct reads: none found
- Direct writes: `src/components/feed/PostCreator.tsx:217`, `src/components/feed/PostCreator.tsx:303`
- Policies: **3**
  - **Post owner and recipients can view** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = recipient_id) OR (auth.uid() IN ( SELECT posts.user_id FROM posts WHERE (posts.id = post_recipients.post_id))))`; WITH CHECK none
  - **Post owner can delete recipients** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() IN ( SELECT posts.user_id FROM posts WHERE (posts.id = post_recipients.post_id)))`; WITH CHECK none
  - **Post owner can insert recipients** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() IN ( SELECT posts.user_id FROM posts WHERE (posts.id = post_recipients.post_id)))`

### `public.posts`

- RLS: **enabled**
- Direct reads: `src/components/messages/GroupChatThread.tsx:83`, `src/components/profile/ProfileCompletionBar.tsx:62`, `src/components/profile/UserPosts.tsx:20`, `src/components/scrollytelling.tsx:162`, `src/hooks/useOpportunities.ts:240`, `src/hooks/useOpportunities.ts:446`, `src/pages/FeedPage.tsx:474`, `src/pages/GroupPage.tsx:212`, `src/pages/MessagesPage.tsx:91`, `src/pages/MySavesPage.tsx:844`, `src/pages/NetworkPieChartPage.tsx:120`, `src/pages/ProfilePage.tsx:567`
- Direct writes: `src/components/feed/EditPostDialog.tsx:180`, `src/components/feed/FeedItem.tsx:344`, `src/components/feed/PostCreator.tsx:62`, `src/hooks/useOpportunities.ts:446`, `src/pages/GroupPage.tsx:212`, `src/pages/GroupPage.tsx:233`, `src/pages/GroupPage.tsx:242`
- Policies: **5**
  - **Owner admin or faculty can delete post** — command `DELETE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1 FROM post_groups pg WHERE ((pg.post_id = posts.id) AND is_group_faculty(auth.uid(), pg.group_id)))))`; WITH CHECK none
  - **Owner or faculty can update post** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM post_groups pg WHERE ((pg.post_id = posts.id) AND is_group_faculty(auth.uid(), pg.group_id)))))`; WITH CHECK `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM post_groups pg WHERE ((pg.post_id = posts.id) AND is_group_faculty(auth.uid(), pg.group_id)))))`
  - **Posts are viewable based on visibility** — command `SELECT`; roles `PUBLIC`; USING `can_view_post(posts.*)`; WITH CHECK none
  - **Users can create their own posts** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can update their own posts or admins can update any** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))`

### `public.profile_flipbook`

- RLS: **enabled**
- Direct reads: none found
- Direct writes: none found
- Policies: **4**
  - **Anyone can view flipbook photos** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own flipbook photos** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can insert their own flipbook photos** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can update their own flipbook photos** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.profile_views`

- RLS: **enabled**
- Direct reads: `src/components/insights/PersonalAnalytics.tsx:83`, `supabase/functions/track-profile-view/index.ts:65`
- Direct writes: `supabase/functions/track-profile-view/index.ts:87`
- Policies: **1**
  - **Users can view their own profile views** — command `SELECT`; roles `PUBLIC`; USING `(viewed_profile_id = (auth.uid())::text)`; WITH CHECK none

### `public.profiles`

- RLS: **enabled**
- Direct reads: `src/components/NavigationWheel.tsx:107`, `src/components/admin/AffiliationRequestsManager.tsx:62`, `src/components/events/EventRsvpForm.tsx:227`, `src/components/feed/FeedItem.tsx:474`, `src/components/feed/PostCreator.tsx:200`, `src/components/feed/ServicesTab.tsx:31`, `src/components/feed/YouTab.tsx:136`, `src/components/layout/MainNav.tsx:107`, `src/components/layout/MainNav.tsx:89`, `src/components/opportunities/ApplicationDialog.tsx:62`, `src/components/projects/OpenRolesDisplay.tsx:89`, `src/components/projects/OpenRolesFeed.tsx:108`, `src/hooks/useEventRsvps.ts:91`, `src/hooks/useTour.ts:34`, `src/pages/FeedPage.tsx:417`, `src/pages/ProfilePage.tsx:416`, `src/pages/ProfilePage.tsx:595`, `src/pages/ProfileSettingsPage.tsx:298`, `src/pages/ProfileSettingsPage.tsx:323`, `src/pages/ProfileSettingsPage.tsx:334`, `supabase/functions/create-ticket-checkout/index.ts:45`, `supabase/functions/send-notification-email/index.ts:294`, `supabase/functions/send-notification-email/index.ts:70`, `supabase/functions/send-ticket-email/index.ts:95`, `supabase/functions/stripe-webhook/index.ts:17`, `supabase/functions/verify-ticket-checkout/index.ts:18`
- Direct writes: `src/components/feed/PostCreator.tsx:207`, `src/components/profile/WhyIStarted.tsx:99`, `src/hooks/useTour.ts:87`, `src/pages/FeedPage.tsx:447`, `src/pages/OnboardingSurveyPage.tsx:47`, `src/pages/ProfilePage.tsx:1011`, `src/pages/ProfilePage.tsx:1030`, `src/pages/ProfilePage.tsx:802`, `src/pages/ProfilePage.tsx:860`, `src/pages/ProfilePage.tsx:896`, `src/pages/ProfileSettingsPage.tsx:410`, `src/pages/ProfileSettingsPage.tsx:449`, `src/pages/ProfileSettingsPage.tsx:540`, `supabase/functions/stripe-webhook/index.ts:182`
- Policies: **4**
  - **Authenticated users can view visible profiles** — command `SELECT`; roles `authenticated`; USING `profile_is_visible_to_current_user(user_id)`; WITH CHECK none
  - **Users can insert their own profile** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can update their own profile** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their own full profile** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.project_credit_invites`

- RLS: **enabled**
- Direct reads: `src/components/admin/CreditVerificationManager.tsx:86`
- Direct writes: none found
- Policies: **1**
  - **Project collaborators and admins can view credit invites** — command `SELECT`; roles `authenticated`; USING `(has_role(auth.uid(), 'admin'::app_role) OR (inviter_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_credit_invites.project_id) AND (p.creator_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM project_members pm WHERE ((pm.project_id = project_credit_invites.project_id) AND (pm.user_id = auth.uid())))))`; WITH CHECK none

### `public.project_group_chats`

- RLS: **enabled**
- Direct reads: `src/hooks/useGroupChats.ts:56`
- Direct writes: `src/hooks/useGroupChats.ts:173`, `src/pages/MySavesPage.tsx:129`
- Policies: **1**
  - **Members can view group chats** — command `SELECT`; roles `PUBLIC`; USING `(EXISTS ( SELECT 1 FROM group_chat_members gcm WHERE ((gcm.group_chat_id = project_group_chats.id) AND (gcm.user_id = auth.uid()))))`; WITH CHECK none

### `public.project_groups`

- RLS: **enabled**
- Direct reads: `src/pages/FeedPage.tsx:374`
- Direct writes: `src/pages/ProjectNewPage.tsx:150`
- Policies: **3**
  - **Members can read project-group links** — command `SELECT`; roles `PUBLIC`; USING `(is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id))`; WITH CHECK none
  - **Project creator can tag own project to a group they belong to** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_groups.project_id) AND (p.creator_id = auth.uid())))) AND (is_group_member(auth.uid(), group_id) OR is_group_faculty(auth.uid(), group_id)))`
  - **Project creator or faculty can untag project** — command `DELETE`; roles `PUBLIC`; USING `((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_groups.project_id) AND (p.creator_id = auth.uid())))) OR is_group_faculty(auth.uid(), group_id))`; WITH CHECK none

### `public.project_invitations`

- RLS: **enabled**
- Direct reads: `src/components/invitations/InvitationsList.tsx:18`, `src/components/invitations/ProjectInvitationPrompt.tsx:42`, `src/components/projects/OpenRolesDisplay.tsx:166`
- Direct writes: `src/components/feed/ProjectWizard.tsx:107`, `src/components/invitations/InvitationCard.tsx:78`, `src/components/invitations/ProjectInvitationPrompt.tsx:102`, `src/components/projects/ProjectCreator.tsx:100`, `src/pages/ProjectDetailPage.tsx:618`, `src/pages/ProjectNewPage.tsx:135`
- Policies: **3**
  - **Invitation receiver can update status** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid() = receiver_id) OR (auth.uid() = sender_id))`; WITH CHECK none
  - **Project creator can send invitations** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = sender_id)`
  - **Users can view their own invitations** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = sender_id) OR (auth.uid() = receiver_id))`; WITH CHECK none

### `public.project_links`

- RLS: **enabled**
- Direct reads: `src/pages/ProjectDetailPage.tsx:312`
- Direct writes: `src/pages/ProjectDetailPage.tsx:490`, `src/pages/ProjectDetailPage.tsx:526`, `src/pages/ProjectDetailPage.tsx:546`
- Policies: **4**
  - **Link owners or project creators can delete links** — command `DELETE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_links.project_id) AND (p.creator_id = auth.uid())))))`; WITH CHECK none
  - **Link owners or project creators can update links** — command `UPDATE`; roles `PUBLIC`; USING `((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_links.project_id) AND (p.creator_id = auth.uid())))) OR ((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM project_members pm WHERE ((pm.project_id = project_links.project_id) AND (pm.user_id = auth.uid()))))))`; WITH CHECK `((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_links.project_id) AND (p.creator_id = auth.uid())))) OR ((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM project_members pm WHERE ((pm.project_id = project_links.project_id) AND (pm.user_id = auth.uid()))))))`
  - **Project members can add links** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((auth.uid() = user_id) AND ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_links.project_id) AND (p.creator_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM project_members pm WHERE ((pm.project_id = project_links.project_id) AND (pm.user_id = auth.uid()))))))`
  - **Users can view links for accessible projects** — command `SELECT`; roles `PUBLIC`; USING `can_access_project(project_id)`; WITH CHECK none

### `public.project_members`

- RLS: **enabled**
- Direct reads: `src/components/profile/MyProjects.tsx:45`, `src/components/profile/ProfileCompletionBar.tsx:50`, `src/components/projects/OpenRolesDisplay.tsx:180`, `src/hooks/useCreditVerification.ts:287`, `src/hooks/useCreditVerification.ts:299`, `src/hooks/useCreditVerification.ts:324`, `src/hooks/useCreditVerification.ts:347`, `src/pages/ProfilePage.tsx:563`, `src/pages/ProjectDetailPage.tsx:239`, `src/pages/PublicCompanyProjectPage.tsx:30`
- Direct writes: `src/components/feed/ProjectWizard.tsx:83`, `src/components/projects/OpenRolesDisplay.tsx:301`, `src/components/projects/ProjectCreator.tsx:76`, `src/pages/CompanyProfilePage.tsx:703`, `src/pages/OpportunitiesPage.tsx:86`, `src/pages/ProjectDetailPage.tsx:666`, `src/pages/ProjectNewPage.tsx:96`
- Policies: **4**
  - **Anyone can view members of public company-linked projects** — command `SELECT`; roles `anon`; USING `(EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_members.project_id) AND (p.company_id IS NOT NULL) AND COALESCE(p.is_public, false))))`; WITH CHECK none
  - **Project creator can add members** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_members.project_id)))`
  - **Project creator or member themselves can remove membership** — command `DELETE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_members.project_id))))`; WITH CHECK none
  - **Users can view members for accessible projects** — command `SELECT`; roles `PUBLIC`; USING `can_access_project(project_id)`; WITH CHECK none

### `public.project_photos`

- RLS: **enabled**
- Direct reads: `src/hooks/useProjectPhotoUpload.ts:53`, `src/pages/ProjectDetailPage.tsx:264`
- Direct writes: `src/hooks/useProjectPhotoUpload.ts:53`, `src/pages/ProjectDetailPage.tsx:412`
- Policies: **3**
  - **Photo owner or project creator can delete photos** — command `DELETE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_photos.project_id))))`; WITH CHECK none
  - **Project members can add photos** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((auth.uid() IN ( SELECT project_members.user_id FROM project_members WHERE (project_members.project_id = project_photos.project_id))) OR (auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_photos.project_id))))`
  - **Users can view photos for accessible projects** — command `SELECT`; roles `PUBLIC`; USING `can_access_project(project_id)`; WITH CHECK none

### `public.project_roles`

- RLS: **enabled**
- Direct reads: `src/components/feed/ProjectWizard.tsx:94`, `src/components/invitations/InvitationsList.tsx:29`, `src/components/invitations/ProjectInvitationPrompt.tsx:34`, `src/components/notifications/NotificationBell.tsx:94`, `src/components/profile/UserPosts.tsx:52`, `src/components/projects/OpenRolesDisplay.tsx:120`, `src/components/projects/OpenRolesFeed.tsx:121`, `src/components/projects/ProjectCreator.tsx:87`, `src/pages/NotificationsPage.tsx:78`, `src/pages/OpportunitiesPage.tsx:658`, `src/pages/ProfilePage.tsx:583`, `src/pages/ProjectDetailPage.tsx:285`, `src/pages/ProjectDetailPage.tsx:605`, `src/pages/ProjectDetailPage.tsx:646`, `src/pages/ProjectNewPage.tsx:121`, `supabase/functions/send-notification-email/index.ts:201`, `supabase/functions/send-notification-email/index.ts:232`
- Direct writes: `src/components/feed/ProjectWizard.tsx:94`, `src/components/invitations/InvitationCard.tsx:86`, `src/components/projects/ProjectCreator.tsx:87`, `src/pages/ProjectDetailPage.tsx:605`, `src/pages/ProjectDetailPage.tsx:646`, `src/pages/ProjectNewPage.tsx:121`
- Policies: **5**
  - **Anyone can view roles of public company-linked projects** — command `SELECT`; roles `anon`; USING `(EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_roles.project_id) AND (p.company_id IS NOT NULL) AND COALESCE(p.is_public, false))))`; WITH CHECK none
  - **Project creator can delete roles** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_roles.project_id)))`; WITH CHECK none
  - **Project creator can manage roles** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_roles.project_id)))`
  - **Project creator can update roles** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() IN ( SELECT projects.creator_id FROM projects WHERE (projects.id = project_roles.project_id)))`; WITH CHECK none
  - **Users can view roles for accessible projects** — command `SELECT`; roles `PUBLIC`; USING `can_access_project(project_id)`; WITH CHECK none

### `public.projects`

- RLS: **enabled**
- Direct reads: `src/components/admin/CreditVerificationManager.tsx:104`, `src/components/feed/ProjectWizard.tsx:64`, `src/components/invitations/InvitationsList.tsx:38`, `src/components/messages/NewGroupMessageDialog.tsx:37`, `src/components/profile/MyProjects.tsx:38`, `src/components/profile/MyProjects.tsx:61`, `src/components/profile/MyProjects.tsx:95`, `src/components/profile/ProfileCompletionBar.tsx:46`, `src/components/profile/SavedProjects.tsx:62`, `src/components/projects/OpenRolesDisplay.tsx:105`, `src/components/projects/OpenRolesFeed.tsx:131`, `src/components/projects/ProjectCreator.tsx:61`, `src/components/scrollytelling.tsx:155`, `src/hooks/useCreditVerification.ts:311`, `src/hooks/useCreditVerification.ts:334`, `src/pages/CompanyProfilePage.tsx:648`, `src/pages/CompanyProfilePage.tsx:682`, `src/pages/CompanyProfilePage.tsx:982`, `src/pages/FeedPage.tsx:507`, `src/pages/MySavesPage.tsx:248`, `src/pages/OpportunitiesPage.tsx:649`, `src/pages/ProfilePage.tsx:562`, `src/pages/ProjectDetailPage.tsx:199`, `src/pages/ProjectDetailPage.tsx:213`, `src/pages/ProjectNewPage.tsx:76`, `src/pages/ProjectsPage.tsx:127`, `src/pages/ProjectsPage.tsx:62`, `src/pages/PublicCompanyPage.tsx:31`, `src/pages/PublicCompanyProjectPage.tsx:15`, `supabase/functions/send-notification-email/index.ts:321`, `supabase/functions/send-project-credit-invite/index.ts:77`
- Direct writes: `src/components/feed/EditPostDialog.tsx:212`, `src/components/feed/FeedItem.tsx:348`, `src/components/feed/ProjectWizard.tsx:64`, `src/components/projects/ProjectCreator.tsx:61`, `src/components/projects/ProjectStatusDropdown.tsx:55`, `src/pages/CompanyProfilePage.tsx:1090`, `src/pages/CompanyProfilePage.tsx:682`, `src/pages/CompanyProfilePage.tsx:728`, `src/pages/ProjectDetailPage.tsx:363`, `src/pages/ProjectDetailPage.tsx:564`, `src/pages/ProjectDetailPage.tsx:584`, `src/pages/ProjectDetailPage.tsx:683`, `src/pages/ProjectDetailPage.tsx:730`, `src/pages/ProjectNewPage.tsx:76`
- Policies: **10**
  - **Admins can delete any project** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can update any project** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can view all projects** — command `SELECT`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Authenticated users can create projects** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() IS NOT NULL)`
  - **Authenticated users can view projects** — command `SELECT`; roles `authenticated`; USING `true`; WITH CHECK none
  - **Creator can delete their projects** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = creator_id)`; WITH CHECK none
  - **Creator can update their projects** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = creator_id)`; WITH CHECK none
  - **Creators can view their own projects** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = creator_id)`; WITH CHECK none
  - **Project members can view their projects** — command `SELECT`; roles `authenticated`; USING `(auth.uid() IN ( SELECT project_members.user_id FROM project_members WHERE (project_members.project_id = projects.id)))`; WITH CHECK none
  - **Public projects are viewable by visitors** — command `SELECT`; roles `anon`; USING `COALESCE(is_public, false)`; WITH CHECK none

### `public.resources`

- RLS: **enabled**
- Direct reads: `src/components/admin/ResourcesManager.tsx:66`, `src/pages/ResourcesPage.tsx:257`
- Direct writes: `src/components/admin/ResourcesManager.tsx:110`, `src/components/admin/ResourcesManager.tsx:124`, `src/components/admin/ResourcesManager.tsx:92`, `src/components/admin/ResourcesManager.tsx:95`
- Policies: **4**
  - **Admins can delete resources** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert resources** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update resources** — command `UPDATE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Resources are publicly viewable** — command `SELECT`; roles `PUBLIC`; USING `((is_active = true) OR has_role(auth.uid(), 'admin'::app_role))`; WITH CHECK none

### `public.role_applications`

- RLS: **enabled**
- Direct reads: `src/components/projects/OpenRolesDisplay.tsx:196`, `src/components/projects/OpenRolesDisplay.tsx:216`, `src/components/projects/OpenRolesFeed.tsx:164`, `src/pages/OpportunitiesPage.tsx:745`
- Direct writes: `src/components/projects/OpenRolesDisplay.tsx:260`, `src/components/projects/OpenRolesDisplay.tsx:292`, `src/components/projects/OpenRolesFeed.tsx:178`, `src/pages/OpportunitiesPage.tsx:78`
- Policies: **4**
  - **Anyone can view applications for public projects** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = applicant_id) OR (auth.uid() IN ( SELECT p.creator_id FROM (projects p JOIN project_roles pr ON ((pr.project_id = p.id))) WHERE (pr.id = role_applications.project_role_id))))`; WITH CHECK none
  - **Applicant can withdraw application** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = applicant_id)`; WITH CHECK none
  - **Applicant or project creator can update** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid() = applicant_id) OR (auth.uid() IN ( SELECT p.creator_id FROM (projects p JOIN project_roles pr ON ((pr.project_id = p.id))) WHERE (pr.id = role_applications.project_role_id))))`; WITH CHECK none
  - **Users can submit applications** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = applicant_id)`

### `public.saved_films`

- RLS: **enabled**
- Direct reads: `src/hooks/useSavedFilms.ts:15`
- Direct writes: `src/components/profile/SavedShows.tsx:159`, `src/hooks/useSavedFilms.ts:28`, `src/hooks/useSavedFilms.ts:46`
- Policies: **3**
  - **Users can save films** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can unsave films** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their saved films** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.saved_items`

- RLS: **enabled**
- Direct reads: `src/hooks/useSavedItems.ts:36`
- Direct writes: `src/hooks/useSavedItems.ts:50`, `src/hooks/useSavedItems.ts:72`
- Policies: **3**
  - **Users can save items** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can unsave items** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their own saved items** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.saved_projects`

- RLS: **enabled**
- Direct reads: `src/components/profile/MyProjects.tsx:86`, `src/components/profile/SavedProjects.tsx:53`, `src/pages/FeedPage.tsx:653`, `src/pages/MySavesPage.tsx:242`, `src/pages/ProfilePage.tsx:565`, `src/pages/ProjectDetailPage.tsx:329`, `src/pages/ProjectsPage.tsx:102`, `src/pages/ProjectsPage.tsx:118`
- Direct writes: `src/components/profile/SavedProjects.tsx:88`, `src/pages/FeedPage.tsx:669`, `src/pages/FeedPage.tsx:684`, `src/pages/MySavesPage.tsx:429`, `src/pages/ProjectDetailPage.tsx:453`, `src/pages/ProjectDetailPage.tsx:460`, `src/pages/ProjectsPage.tsx:241`, `src/pages/ProjectsPage.tsx:258`
- Policies: **3**
  - **Users can save projects** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can unsave projects** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their saved projects** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.saved_shows`

- RLS: **enabled**
- Direct reads: `src/components/stage-whisper/MyShowList.tsx:35`, `src/hooks/useSavedShows.ts:16`, `src/pages/ProfilePage.tsx:576`
- Direct writes: `src/components/profile/AddAttendedDialog.tsx:127`, `src/hooks/useSavedShows.ts:30`
- Policies: **4**
  - **Users can save shows** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can unsave shows** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their saved shows** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view saved shows** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.user_id = saved_shows.user_id) AND (profiles.watchlist_public = true)))))`; WITH CHECK none

### `public.show_reminders`

- RLS: **enabled**
- Direct reads: none found
- Direct writes: none found
- Policies: **4**
  - **Users can create reminders** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can delete their reminders** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their reminders** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can view their reminders** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.show_teammates`

- RLS: **enabled**
- Direct reads: `src/components/stage-whisper/EditShowDialog.tsx:101`, `src/components/stage-whisper/ShowDetailSheet.tsx:114`
- Direct writes: `src/components/stage-whisper/AddShowDialog.tsx:226`, `src/components/stage-whisper/EditShowDialog.tsx:254`, `src/components/stage-whisper/EditShowDialog.tsx:266`
- Policies: **4**
  - **Anyone can view show teammates** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Show submitter can add teammates** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() IN ( SELECT nyc_shows.submitted_by FROM nyc_shows WHERE (nyc_shows.id = show_teammates.show_id)))`
  - **Show submitter can remove teammates** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() IN ( SELECT nyc_shows.submitted_by FROM nyc_shows WHERE (nyc_shows.id = show_teammates.show_id)))`; WITH CHECK none
  - **Teammates can remove themselves** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.show_tips`

- RLS: **enabled**
- Direct reads: `src/components/admin/BroadwayShowsManager.tsx:88`, `src/components/stage-whisper/ShowDetailSheet.tsx:83`
- Direct writes: `src/components/admin/BroadwayShowsManager.tsx:175`, `src/components/admin/BroadwayShowsManager.tsx:195`, `src/components/stage-whisper/ShowDetailSheet.tsx:175`
- Policies: **4**
  - **Authenticated users can create tips** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Tips are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own tips** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their own tips** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.showcase_profiles`

- RLS: **enabled**
- Direct reads: `src/components/admin/SitesManager.tsx:27`, `src/hooks/useShowcase.ts:104`, `src/hooks/useShowcase.ts:36`, `src/hooks/useShowcase.ts:90`, `src/pages/ShowcaseProfilePage.tsx:34`
- Direct writes: `src/hooks/useShowcase.ts:104`, `src/hooks/useShowcase.ts:129`, `src/pages/ShowcaseJoinPage.tsx:429`, `src/pages/ShowcaseJoinPage.tsx:558`
- Policies: **5**
  - **Admins can manage all showcase profiles** — command `ALL`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Showcase profiles are publicly readable** — command `SELECT`; roles `PUBLIC`; USING `(is_active = true)`; WITH CHECK none
  - **Users can delete their own showcase profile** — command `DELETE`; roles `authenticated`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can insert their own showcase profile** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Users can update their own showcase profile** — command `UPDATE`; roles `authenticated`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.showcase_programs`

- RLS: **enabled**
- Direct reads: `src/components/admin/SitesManager.tsx:15`, `src/hooks/useShowcase.ts:68`
- Direct writes: none found
- Policies: **2**
  - **Admins can manage showcase programs** — command `ALL`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Showcase programs are publicly readable** — command `SELECT`; roles `PUBLIC`; USING `(is_active = true)`; WITH CHECK none

### `public.streaming_content`

- RLS: **enabled**
- Direct reads: `src/components/admin/FilmContentManager.tsx:97`
- Direct writes: `src/components/admin/FilmContentManager.tsx:166`, `src/components/admin/FilmContentManager.tsx:180`, `src/components/admin/FilmContentManager.tsx:194`
- Policies: **4**
  - **Admins can delete streaming content** — command `DELETE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert streaming content** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update streaming content** — command `UPDATE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Streaming content is publicly viewable** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.studio_comments`

- RLS: **enabled**
- Direct reads: `src/components/insights/SchoolStudios.tsx:112`
- Direct writes: `src/components/insights/SchoolStudios.tsx:165`
- Policies: **3**
  - **Authenticated users can create comments** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Comments are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own comments** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.studio_posts`

- RLS: **enabled**
- Direct reads: `src/components/insights/SchoolStudios.tsx:83`, `src/pages/AdminPage.tsx:642`
- Direct writes: `src/components/insights/SchoolStudios.tsx:139`, `src/pages/AdminPage.tsx:653`
- Policies: **5**
  - **Admins can delete any studio posts** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Authenticated users can create posts** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Posts are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own posts** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can update their own posts** — command `UPDATE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.studios`

- RLS: **enabled**
- Direct reads: `src/components/insights/SchoolStudios.tsx:69`, `src/pages/GroupMembersPage.tsx:43`, `src/pages/NetworkPieChartPage.tsx:80`, `src/pages/PeoplePage.tsx:233`, `src/pages/ProfilePage.tsx:1049`
- Direct writes: `src/components/admin/AffiliationRequestsManager.tsx:93`
- Policies: **2**
  - **Admins can insert studios** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Studios are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.tickets`

- RLS: **enabled**
- Direct reads: `src/components/admin/EventsManager.tsx:1263`, `src/components/events/EventRsvpForm.tsx:74`, `src/components/feed/FeedItem.tsx:227`, `src/pages/EventDashboardPage.tsx:254`, `src/pages/MyTicketsPage.tsx:76`, `supabase/functions/create-ticket-checkout/index.ts:123`, `supabase/functions/create-ticket-checkout/index.ts:139`, `supabase/functions/send-ticket-email/index.ts:43`, `supabase/functions/send-ticket-email/index.ts:62`, `supabase/functions/stripe-webhook/index.ts:110`, `supabase/functions/stripe-webhook/index.ts:131`, `supabase/functions/stripe-webhook/index.ts:149`, `supabase/functions/verify-ticket-checkout/index.ts:118`, `supabase/functions/verify-ticket-checkout/index.ts:76`
- Direct writes: `src/components/admin/EventsManager.tsx:1287`, `src/pages/EventDashboardPage.tsx:426`, `supabase/functions/create-ticket-checkout/index.ts:160`, `supabase/functions/create-ticket-checkout/index.ts:238`, `supabase/functions/create-ticket-checkout/index.ts:239`, `supabase/functions/send-ticket-email/index.ts:180`, `supabase/functions/send-ticket-email/index.ts:197`, `supabase/functions/send-ticket-email/index.ts:62`, `supabase/functions/stripe-webhook/index.ts:131`, `supabase/functions/stripe-webhook/index.ts:149`, `supabase/functions/stripe-webhook/index.ts:232`, `supabase/functions/stripe-webhook/index.ts:257`, `supabase/functions/verify-ticket-checkout/index.ts:118`, `supabase/functions/verify-ticket-checkout/index.ts:94`
- Policies: **4**
  - **Authenticated users can create tickets** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Event hosts can update ticket check-ins** — command `UPDATE`; roles `PUBLIC`; USING `(EXISTS ( SELECT 1 FROM events e WHERE ((e.id = tickets.event_id) AND (e.user_id = auth.uid()))))`; WITH CHECK `(EXISTS ( SELECT 1 FROM events e WHERE ((e.id = tickets.event_id) AND (e.user_id = auth.uid()))))`
  - **Event hosts can view event tickets** — command `SELECT`; roles `PUBLIC`; USING `(EXISTS ( SELECT 1 FROM events e WHERE ((e.id = tickets.event_id) AND (e.user_id = auth.uid()))))`; WITH CHECK none
  - **Users can view their own tickets** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.tip_votes`

- RLS: **enabled**
- Direct reads: `src/components/stage-whisper/ShowDetailSheet.tsx:162`
- Direct writes: `src/components/stage-whisper/ShowDetailSheet.tsx:204`, `src/components/stage-whisper/ShowDetailSheet.tsx:211`
- Policies: **3**
  - **Users can remove their vote** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none
  - **Users can vote** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = user_id)`
  - **Votes are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

### `public.user_engagement`

- RLS: **enabled**
- Direct reads: `src/components/insights/PersonalAnalytics.tsx:64`, `src/hooks/useAnalytics.ts:59`
- Direct writes: `src/hooks/useAnalytics.ts:69`, `src/hooks/useAnalytics.ts:80`
- Policies: **3**
  - **Authenticated users can insert their own engagement** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((auth.uid())::text = user_id)`
  - **Authenticated users can update their own engagement** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid())::text = user_id)`; WITH CHECK none
  - **Users can view their own engagement** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid())::text = user_id)`; WITH CHECK none

### `public.user_films`

- RLS: **enabled**
- Direct reads: `src/components/stage-whisper/AddFilmDialog.tsx:84`, `src/pages/StageWhisperPage.tsx:200`
- Direct writes: `src/components/stage-whisper/AddFilmDialog.tsx:84`
- Policies: **7**
  - **Admins can delete any film** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert any film** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update any film** — command `UPDATE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **User films are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own films** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = submitted_by)`; WITH CHECK none
  - **Users can submit films** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `((auth.uid() IS NOT NULL) AND (submitted_by = auth.uid()))`
  - **Users can update their own films** — command `UPDATE`; roles `authenticated`; USING `(auth.uid() = submitted_by)`; WITH CHECK `(auth.uid() = submitted_by)`

### `public.user_media`

- RLS: **enabled**
- Direct reads: `src/components/profile/ProfileCompletionBar.tsx:33`, `src/components/profile/PublicMediaGallery.tsx:41`, `src/hooks/useMediaUpload.ts:189`, `src/hooks/useMediaUpload.ts:89`, `src/pages/ProfilePage.tsx:545`
- Direct writes: `src/components/profile/VideoCoverUploader.tsx:74`, `src/components/profile/VideoCoverUploader.tsx:97`, `src/components/profile/VideoLinkUploader.tsx:46`, `src/hooks/useMediaUpload.ts:137`, `src/hooks/useMediaUpload.ts:160`, `src/hooks/useMediaUpload.ts:89`
- Policies: **5**
  - **Anyone can view public media** — command `SELECT`; roles `PUBLIC`; USING `(visibility = 'public'::text)`; WITH CHECK none
  - **Users can delete their own media** — command `DELETE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.user_id = user_media.user_id) AND (lower(p.email) = lower((auth.jwt() ->> 'email'::text)))))))`; WITH CHECK none
  - **Users can insert their own media** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.user_id = user_media.user_id) AND (lower(p.email) = lower((auth.jwt() ->> 'email'::text)))))))`
  - **Users can update their own media** — command `UPDATE`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.user_id = user_media.user_id) AND (lower(p.email) = lower((auth.jwt() ->> 'email'::text)))))))`; WITH CHECK none
  - **Users can view their own media** — command `SELECT`; roles `PUBLIC`; USING `((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.user_id = user_media.user_id) AND (lower(p.email) = lower((auth.jwt() ->> 'email'::text)))))))`; WITH CHECK none

### `public.user_music_shows`

- RLS: **enabled**
- Direct reads: `src/components/admin/MusicShowsManager.tsx:151`, `src/components/admin/MusicShowsManager.tsx:92`, `src/pages/StageWhisperPage.tsx:218`
- Direct writes: `src/components/admin/MusicShowsManager.tsx:151`, `src/components/admin/MusicShowsManager.tsx:168`, `src/components/admin/MusicShowsManager.tsx:190`, `src/components/admin/MusicShowsManager.tsx:216`, `src/components/stage-whisper/AddMusicShowDialog.tsx:100`
- Policies: **7**
  - **Admins can delete any music show** — command `DELETE`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can insert any music show** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Admins can update any music show** — command `UPDATE`; roles `authenticated`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK `has_role(auth.uid(), 'admin'::app_role)`
  - **Music shows are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none
  - **Users can delete their own music shows** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = submitted_by)`; WITH CHECK none
  - **Users can submit music shows** — command `INSERT`; roles `authenticated`; USING none; WITH CHECK `((auth.uid() IS NOT NULL) AND (submitted_by = auth.uid()))`
  - **Users can update their own music shows** — command `UPDATE`; roles `authenticated`; USING `(auth.uid() = submitted_by)`; WITH CHECK `(auth.uid() = submitted_by)`

### `public.user_roles`

- RLS: **enabled**
- Direct reads: `supabase/functions/create-event-price/index.ts:38`, `supabase/functions/send-company-staff-link/index.ts:71`
- Direct writes: none found
- Policies: **3**
  - **Admins can manage roles** — command `ALL`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Admins can view all roles** — command `SELECT`; roles `PUBLIC`; USING `has_role(auth.uid(), 'admin'::app_role)`; WITH CHECK none
  - **Users can view their own roles** — command `SELECT`; roles `PUBLIC`; USING `(auth.uid() = user_id)`; WITH CHECK none

### `public.vouches`

- RLS: **enabled**
- Direct reads: `src/hooks/useVouch.ts:16`
- Direct writes: `src/hooks/useVouch.ts:65`, `src/hooks/useVouch.ts:92`
- Policies: **3**
  - **Users can remove their vouches** — command `DELETE`; roles `PUBLIC`; USING `(auth.uid() = voucher_id)`; WITH CHECK none
  - **Users can vouch for others** — command `INSERT`; roles `PUBLIC`; USING none; WITH CHECK `(auth.uid() = voucher_id)`
  - **Vouches are viewable by everyone** — command `SELECT`; roles `PUBLIC`; USING `true`; WITH CHECK none

## Verification checklist

1. Verified the worktree base and local `origin/main` resolve to `21f034010c15ad2f61c2051b1520a7e2f5601367`.
2. Verified the preserved report remains at `rls-review-sep22-base.md` and this report is based on a clean local Supabase reset from the new base.
3. Verified all 70 effective local `public` tables, all 257 effective local policies, and the 22-table literal-true set from the local database.
4. Verified the supplied 28-table scanner list by exact-name set comparison: 21 overlap the literal-true set, seven are conditional local `public` tables, and local literal-true `projects` is absent from the scanner list.
5. Verified that the old eight-table scanner gap became seven because `groups` resolves to literal-true after the fresh clean reset; `projects` does as well but is outside the scanner list. No tracked migration changed between the two Git bases.
6. Verified the group/project classification against routes, direct Supabase queries, generated table shapes, and tracked policy migrations cited in Phase 2.
7. Verified all 16 `companies`, six `company_photos`, and 19 `projects` columns against the generated row types and traced their public/browse consumption in Phase 2.5.
8. Verified that, on the reviewed browse surfaces, `owner_user_id` is consumed only by the in-app company page's owner lookup/management logic, `uploaded_by` has no read-side UI consumer, and `google_drive_url` is rendered only inside the project member UI despite being selectable under the broader project read policies.
9. Verified no repository migration or schema change exists between `fe33c38de6db499ae5b29cf96a85a960fda826c4` and `21f034010c15ad2f61c2051b1520a7e2f5601367`; the tracked change is confined to the notification-email Edge Function.
10. Could not verify hosted schema or policy drift because no hosted Supabase command was run.
11. Could not verify Lovable's internal matching algorithm or the hosted schema revision it scanned; the “scanner counting differently” conclusion is the only explanation supported by the local predicates and exact set comparison.
12. Could not derive product intent for `profile_flipbook`, universal group discoverability, teammate/tip attribution, publication of unverified credits, or public identification of company owners from current runtime code; each is marked **CONFIRM WITH CLELY**.

## Phase 3 — Group 1 implementation

Status: **IMPLEMENTED LOCALLY; OWNER MANUAL VERIFICATION PASSED**

Migration: `supabase/migrations/20261001161217_inv96_group1_private_identity_rows.sql`

- `profile_flipbook`: replaced anonymous reads with authenticated owner-only reads (`auth.uid() = user_id`).
- `tip_votes`: replaced anonymous reads with authenticated self-only reads; insert and delete policies now explicitly target `authenticated`.
- `vouches`: replaced anonymous reads with authenticated voucher-only reads; insert and delete policies now explicitly target `authenticated`. Public profile counts continue to come from `profiles_public.vouch_count`.
- `credit_vouches`: replaced anonymous reads with authenticated voucher-only reads; insert and delete policies now explicitly target `authenticated`.
- Added authenticated `get_credit_vouch_state(uuid)`, which returns only the aggregate count and whether the caller has vouched. It does not return voucher IDs.
- Updated `src/hooks/useCreditVerification.ts` to use the aggregate RPC instead of selecting raw `credit_vouches` rows.
- No rows, users, fixtures, tables, or columns are deleted or modified by this migration.
- A manual rollback is included as a non-executing block at the end of the migration.

### Automated implementation checks

- `npx supabase migration up --local`: applied only `20261001161217_inv96_group1_private_identity_rows.sql` to the local Docker database; no reset or hosted command was used.
- Local catalog inspection: the four replacement `SELECT` policies target `authenticated` and use caller-identity predicates; `get_credit_vouch_state(uuid)` is `SECURITY DEFINER`, with no `anon` execute grant.
- Local fixture-presence inspection through the database owner connection: the two flipbook rows and the existing tip-vote, profile-vouch, and credit-vouch fixtures remain present. This is a preservation check, not an RLS behavior verification.
- `npm run typecheck`: passed.
- `npm run build:sandbox`: passed with pre-existing Browserslist, Tailwind class ambiguity, and bundle-size warnings.
- `git diff --check`: passed.
- Targeted ESLint remains blocked by four existing `@typescript-eslint/no-explicit-any` errors in `src/hooks/useCreditVerification.ts` outside the Group 1 change (lines 55, 131, 224, and 251 after this edit). These unrelated handlers were not changed.
- No commit, push, pull request, GitHub request, hosted Supabase command, or destructive database command was run.

### Owner-reported pre-change baseline

The owner reported that anonymous REST reads exposed rows from `profile_flipbook`, `tip_votes`, `vouches`, and `credit_vouches`. The owner also completed the profile-vouch, credit-vouch, and tip-vote product fixtures. These observations are recorded as owner-reported and are not a Codex verification result.

### Group 1 owner verification checklist

1. Confirm anonymous REST reads of all four base tables return `[]`.
2. Confirm the owner token sees only the owner `profile_flipbook` row and the other token sees only the other row.
3. Confirm each signed-in token sees only its own `tip_votes`, `vouches`, and `credit_vouches` rows.
4. Confirm `get_credit_vouch_state` rejects the anon token and, for the other token plus the `INV96 Credit` ID, returns the expected count with `has_vouched: true` and no voucher IDs.
5. In the localhost app, confirm the other user can remove and restore the profile vouch and sees the exact success toast.
6. In the localhost app, confirm the other user can remove and restore the `INV96 Credit` vouch and that the count changes without exposing voucher identities.
7. In the localhost app, confirm the other user can remove and restore the vote on `INV96 verification tip` and that the helpful count changes.
8. Paste every command response, browser error, unexpected row, failed toast, and console/network error back to Codex. Codex does not mark this group verified.

### Owner-reported verification results

Completed by the owner against `http://127.0.0.1:54321` and the sandbox app at `http://localhost:8081`:

1. **PASS** — all required environment variables were set and the sandbox app loaded.
2. **PASS** — anonymous REST reads of `profile_flipbook`, `tip_votes`, `vouches`, and `credit_vouches` each returned `[]`.
3. **PASS** — the owner token saw only the owner flipbook row (`display_order = 9601`), and the other-user token saw only the other-user row (`display_order = 9602`).
4. **PASS** — the owner token saw no Group 1 relationship fixtures; the other-user token saw only its own tip vote, profile vouch, and credit vouch.
5. **PASS** — authenticated `get_credit_vouch_state` returned `[{"vouch_count":1,"has_vouched":true}]` without a voucher identifier.
6. **PASS** — anonymous `get_credit_vouch_state` returned HTTP `401` with PostgreSQL code `42501` and `permission denied for function get_credit_vouch_state`.
7. **PASS** — the other user removed and restored the profile vouch, receiving `Vouch removed` and `Vouched! Your endorsement helps this person stand out.`
8. **PASS** — the other user removed and restored the `INV96 Credit` vouch, receiving `Vouch removed` and `Vouched for this credit!`.
9. **PASS** — the other user removed and restored the vote on `INV96 verification tip`.
10. **PASS** — the profile-vouch, credit-vouch, and tip-vote counts changed correctly when removed and restored.

These are owner-executed and owner-confirmed results. Codex did not independently confirm the manual checks.

## Phase 3 — Group 2 implementation

Status: **IMPLEMENTED LOCALLY; OWNER MANUAL VERIFICATION COMPLETE WITH ONE ACCEPTED FIXTURE GAP**

Migrations:

- `supabase/migrations/20261002135954_inv96_group2_anonymous_browse_views.sql`
- `supabase/migrations/20261002141000_inv96_group2_browse_view_grants.sql`
- `supabase/migrations/20261002142500_inv96_group2_normalize_anonymous_owner_state.sql`

### Policy and API changes

- `user_films`, `user_music_shows`, and `nyc_shows`: replaced anonymous base-table reads with authenticated owner-only and admin-only `SELECT` policies.
- Added active-row browse views `user_films_browse`, `user_music_shows_browse`, and `nyc_shows_browse`.
- Browse views omit `submitted_by` for every caller and expose only caller-relative `is_owner` for owner controls. The ownership flag is normalized with `coalesce(..., false)`, so callers without a user ID receive `false` rather than SQL `NULL`.
- `anon` and `authenticated` have exactly `SELECT` on the browse views and no write-class view privilege.
- The migrations do not delete or update fixture rows. All three files include manual rollback instructions.

### Frontend impact

- `src/pages/StageWhisperPage.tsx`: theatre, community-film, and music discovery reads now use browse views. Without this change, tightened base policies would hide other users' listings.
- `src/pages/MySavesPage.tsx`: saved-show detail hydration now uses `nyc_shows_browse`. Without this change, users could not resolve shows submitted by someone else or seeded shows with no submitter.
- `src/components/stage-whisper/MyShowList.tsx`: saved-show hydration now uses `nyc_shows_browse` for the same reason.
- `src/components/profile/AddAttendedDialog.tsx`: the attended-show picker now uses `nyc_shows_browse`; otherwise most shows would disappear.
- `src/pages/MessagesPage.tsx` and `src/components/messages/GroupChatThread.tsx`: shared-show detail reads now use `nyc_shows_browse`; otherwise recipients could not open another user's show.
- `src/components/stage-whisper/ShowCard.tsx` and `ShowDetailSheet.tsx`: ownership can come from the view's `is_owner` flag without exposing `submitted_by`.
- Admin managers intentionally continue reading the base tables under admin policies.

### Owner-reported pre-change baseline

1. The three browse endpoints initially returned HTTP `404` / `PGRST205` because the views did not exist.
2. The guarded browse assertion returned `false` for each missing endpoint.
3. Anonymous, owner, and unrelated-user tokens could all read the owner UUID from the three base tables.
4. The signed-out `/industry-now` page displayed the current `VisitorAuthPrompt`, so cards were not visible through the UI while signed out.
5. Creating the film through the product UI failed with database code `42P10`; the owner created the film, music, and show fixtures through local Studio Table Editor instead.

These are owner-reported baseline observations, not Codex verification results.

### Automated implementation checks

- All three Group 2 migrations applied with `npx supabase migration up --local`; no reset or hosted command was used.
- Local catalog inspection found exactly two base-table `SELECT` policies per table: authenticated owner and authenticated admin.
- Local catalog inspection found the three browse views use `security_barrier=true`, `security_invoker=false`, omit `submitted_by`, filter to active rows, and expose `is_owner`.
- Local grant inspection found `anon` and `authenticated` have `SELECT` and no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` privilege on each browse view.
- The three named Group 2 fixtures remain present.
- `npm run typecheck`: passed.
- `npm run test:run`: passed (14 test files, 37 tests).
- `npm run build:sandbox`: passed with pre-existing Browserslist, Tailwind class ambiguity, and bundle-size warnings.
- `git diff --check`: passed.
- Targeted lint remains blocked by existing lint debt in the touched files: 24 errors and one warning, none on a Group 2 changed line.
- No hosted Supabase command, reset, or destructive database command was run for Group 2.

### Shared sandbox CI blocker

- The existing PR's sandbox-preview job fails before applying INV96 migrations because the shared hosted sandbox migration table contains 29 versions from the unmerged `codex/groups-96-97-118` branch that are absent from both `origin/main` and the INV96 PR branch.
- Those files are Groups-feature migrations and remain out of scope for INV96. They were not copied, cherry-picked, or recreated here.
- No `supabase migration repair`, hosted `supabase db pull`, hosted `supabase db push`, or other hosted database command was run. The shared sandbox must be reconciled by its owner, or the Groups work must reach `main`, before the INV96 migration-preview job can pass safely.

### Owner-reported in-progress verification

1. **PASS** — anonymous reads of all three browse views returned arrays with no `submitted_by` key.
2. **PARTIAL BEFORE CORRECTION** — the owner received `is_owner=true` and the unrelated user received `is_owner=false` for all three owner fixtures, but the anonymous caller received `is_owner=null`.
3. **PASS AFTER CORRECTION** — after a follow-up local migration changed each view expression to `coalesce(submitted_by = auth.uid(), false)`, the anonymous caller received `is_owner=false` for the owner film, music, and show fixtures.
4. **PASS** — anonymous and unrelated-user base-table reads returned `[]` for all three owner fixtures. The owner and admin each received exactly the expected owner fixture from `user_films`, `user_music_shows`, and `nyc_shows`.
5. **PASS** — anonymous `INSERT` attempts against all three browse views returned HTTP `401`, PostgreSQL code `42501`, and `permission denied for view ...` without reaching an insert path.
6. **PASS AFTER CONFIRMED-WORKTREE RETEST** — the initial unrelated-user product attempt showed no fixtures. After starting the frontend from `/Users/clely/.codex/worktrees/inv96-rls-group2/inlight`, the unrelated user saw the film, music, and theatre fixtures and had no theatre edit control. The owner saw all three fixtures and retained the theatre edit control.
7. **PASS** — the unrelated user saved the owner-submitted theatre fixture, saw and opened it from **My List**, and saw and opened it from `/saves` without receiving the owner edit control.
8. **PASS** — the unrelated user's attended-show picker found the owner-submitted theatre fixture, displayed the expected success toast, and showed the fixture in **Attended** after refresh.
9. **PASS** — the admin manager listed the owner-submitted theatre and music fixtures. The community film appeared in Industry Now, and all three fixtures exposed their admin controls without database or loading errors. No delete control was activated.
10. **PASS** — a correctly encoded local owner-to-other shared-show message returned HTTP `201`, rendered as an `INV96 Anonymous Show` card, and opened the show detail sheet for the unrelated user without an owner edit control. An earlier malformed local test message remains untouched.
11. **NOT EXERCISED — NO FIXTURE** — read-only membership checks returned `OWNER_GROUPS=[]`, `OTHER_GROUPS=[]`, and `common_group_ids=[]`. The `GroupChatThread` shared-show detail path cannot be manually exercised without creating a local project group chat and memberships; none were created.

Owner disposition: Group 2 is accepted with item 11 retained as an explicit untested gap. No project, group chat, membership, or group-chat message fixture is required for this group.

These are owner-reported results. Codex did not independently confirm the manual checks.

## Phase 3 — Group 3 implementation

Status: **IMPLEMENTED LOCALLY; OWNER MANUAL VERIFICATION PASSED**

Migration: `supabase/migrations/20261002152000_inv96_group3_verified_public_credits.sql`

### Policy changes

- `credits`: replaced the unrestricted `SELECT USING (true)` policy with three explicit read policies.
- Anonymous and authenticated callers may read rows where `verified IS TRUE`.
- Authenticated owners may read all of their own credit rows, including drafts.
- Authenticated admins may read every credit row.
- Existing insert, update, delete, verification-request, and credit-vouch behavior is unchanged.
- The migration does not insert, update, or delete any credit or verification-request row and includes a manual rollback block.

### Frontend impact

- No frontend query changes are required. `src/pages/ProfilePage.tsx` already queries `credits` by profile `user_id`; RLS now removes unverified rows for visitors and unrelated users while preserving them on the owner's profile.
- `src/components/admin/CreditVerificationManager.tsx` continues joining verification requests to `credits`; the admin read policy preserves that workflow.
- `src/lib/projectInvitationCredits.ts` continues finding and creating the signed-in user's own credits; the owner read policy preserves that workflow.

### Owner-reported pre-change baseline

1. The owner created `INV96 Draft Credit` (`173a97f1-7acc-4d1c-9701-2849b1e23a4a`) with `verified=false`.
2. The owner created `INV96 Verified Credit` (`bb1fe40a-d9c0-4472-b634-9a0cb65cf07f`) and completed the local admin approval workflow, producing `verified=true`.
3. Anonymous, unrelated-user, owner, and admin REST reads each returned both fixtures before Group 3 implementation.
4. The older `INV96 Credit` fixture also remains unverified and must follow the same post-change visibility rule as the draft fixture.

These are owner-reported baseline observations. Codex did not independently confirm the manual checks.

### Automated implementation checks

- `npx supabase migration up --local` applied only `20261002152000_inv96_group3_verified_public_credits.sql`; no reset or hosted command was used.
- Local catalog inspection found the three intended `SELECT` policies: verified rows for `anon` and `authenticated`, owner rows for `authenticated`, and all rows for authenticated admins.
- Local database-owner inspection found `INV96 Credit` and `INV96 Draft Credit` still unverified and `INV96 Verified Credit` still verified. This is a fixture-preservation check, not caller-level RLS verification.
- `npm run typecheck`: passed.
- `npm run test:run`: passed (14 test files, 37 tests).
- `git diff --check`: passed.
- No commit, push, hosted Supabase command, reset, or destructive database command was run for Group 3.

### Owner-reported in-progress verification

1. **PASS** — anonymous and unrelated-user REST reads returned only `INV96 Verified Credit` and did not expose `INV96 Credit` or `INV96 Draft Credit`.
2. **PASS** — owner and admin REST reads returned all three owner credits with their expected verified states.
3. **PASS** — no caller received a REST error during the four-role check.
4. **PASS** — the owner profile displayed all three owner credits.
5. **PASS** — the unrelated user saw only `INV96 Verified Credit` on the owner's profile and saw neither unverified credit.
6. **PASS** — the admin Credit Verification Requests manager loaded without a database error, displayed the verified fixture as approved, and opened its review details.

These are owner-reported results. Codex did not independently confirm the manual checks.

### Group 3 owner verification checklist

1. Confirm anonymous and unrelated-user REST reads return `INV96 Verified Credit` but not `INV96 Draft Credit` or the older unverified `INV96 Credit`.
2. Confirm the owner and admin REST reads return all three owner credits.
3. Confirm the owner's profile shows all three credits to the owner, while an unrelated user sees only `INV96 Verified Credit`.
4. Confirm the admin Verification manager still loads and can review credit-verification requests without a database error.
5. Confirm no credit or verification-request fixture was deleted or modified by the migration.
6. Paste every response, missing row, browser error, console/network error, or unexpected draft disclosure back to Codex. Codex does not mark Group 3 verified.

### Group 2 owner verification checklist

1. Confirm anonymous browse-view reads return arrays, include the three active fixtures, and contain no `submitted_by` key.
2. Confirm each browse row reports `is_owner=false` to anonymous and unrelated-user callers, while the owner's three fixtures report `is_owner=true` to the owner.
3. Confirm anonymous and unrelated-user base-table reads return `[]` for all three tables.
4. Confirm the owner sees only the owner's base-table fixtures and the admin sees all base rows.
5. Confirm anonymous writes to each browse view are rejected and create no row.
6. Start the sandbox app from the Group 2 worktree and confirm signed-in owner and other-user discovery still shows the fixtures without exposing submitter identity.
7. Confirm owner controls still appear for the owner's show, saved-show hydration works, the attended-show picker works, shared-show details open, and admin managers still load their base-table records.
8. Keep the `42P10` poster-upload failure recorded as a separate pre-existing product failure; direct fixture creation does not make that workflow pass.
9. Paste every response, missing card/control, browser error, console/network error, or unexpected identity field back to Codex. Codex does not mark Group 2 verified.
