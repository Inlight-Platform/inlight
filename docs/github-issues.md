# GitHub Issues Backlog

This backlog is distilled from the product notes dated February through June 2026. Checked items from the notes were treated as already handled unless they still appear to need follow-up. Each item below is written so it can become a GitHub issue.

The "Platform Bugs" PDF was added as an additional QA source in July 2026. Items from that list are included below either as new issue drafts or as sharper acceptance criteria for existing product issues.

GitHub CLI note: this machine currently has an invalid `gh` token, so these were prepared as reviewable issue drafts rather than created live.

## Suggested labels

- `priority: urgent`
- `priority: high`
- `priority: medium`
- `priority: low`
- `type: bug`
- `type: feature`
- `type: cleanup`
- `area: auth`
- `area: profile`
- `area: industry-now`
- `area: projects`
- `area: opportunities`
- `area: messaging`
- `area: events`
- `area: admin`
- `area: mobile`
- `area: supabase`
- `area: media`
- `area: resources`
- `area: people`
- `area: company`
- `area: feed`
- `area: discovery`

## Recommended issue architecture

Use this structure when creating GitHub issues or assigning onboarding engineers:

- Epic: Authentication and Accounts
  - Password reset loops, duplicate accounts, newly created accounts not showing, test accounts still visible.
- Epic: Permissions and Supabase Security
  - RLS failures, posting permissions, admin/company creation permissions, save and messaging permission bugs.
- Epic: Profiles and Credits
  - Profile fields, affiliation/title handling, generated bios, credit invitation acceptance, profile layout.
- Epic: Projects and Opportunities
  - Project creation routes, Add Credit/Add Role flows, application review, project links, project archive.
- Epic: Posts, Invites, and Media
  - Post creation image UX, multiple images, image previews, collaborator email invites, video/external media.
- Epic: Discovery and Industry Now
  - Theatre/film/music listings, Surprise Me, votes/saves ranking, event/show routing, expired ticket links.
- Epic: UI and Mobile Polish
  - Bottom nav responsiveness, margins, People/Resources layout, card consistency, admin mobile.

For GitHub, create one issue per user-visible bug unless several failures share the same route, database function, or component. Use epics/milestones for grouping instead of making one giant issue.

## Ready-to-create issues

### 1. Audit company account creation and editing

Labels: `priority: urgent`, `type: bug`, `area: admin`, `area: supabase`

Company account creation/editing needs a full audit so company profiles are customizable, easy to manage, and reliable for all supported image types.

Acceptance criteria:

- Company account create/edit flows can save core profile fields.
- Logo, cover, and staff/media images support the intended file types.
- Validation messages are clear when uploads or saves fail.
- Admin and company staff permissions are tested.
- Existing company accounts still render correctly.

### 2. Add titled links to project pages

Labels: `priority: high`, `type: feature`, `area: projects`

Project team members should be able to add relevant links with custom titles on project pages.

Acceptance criteria:

- Authorized project team members can add, edit, and remove titled links.
- Links display on the project page in a polished layout.
- Invalid URLs are blocked with a useful message.
- Non-team members cannot edit project links.

### 3. Fix Industry Now "Surprise Me" across theatre, film, and music

Labels: `priority: high`, `type: bug`, `area: industry-now`

The Surprise Me button works for theatre but can pull expired shows and does not appear reliable for film or music.

Acceptance criteria:

- Surprise Me excludes expired shows/events.
- Theatre, film, and music all return valid active recommendations when data exists.
- Empty states are clear when a category has no active items.
- The selected item opens to the correct detail view.

### 4. Add comments to posts

Labels: `priority: high`, `type: feature`, `area: feed`, `area: supabase`

Users should be able to comment on posts.

Acceptance criteria:

- Authenticated users can add comments to supported post types.
- Comments display under the relevant post.
- Authors can delete their own comments.
- RLS prevents unauthorized edits/deletes.
- Loading, empty, and error states are handled.

### 5. Allow users to share shows through messaging

Labels: `priority: medium`, `type: feature`, `area: messaging`, `area: industry-now`

Users should be able to send shows to friends through the messaging system.

Acceptance criteria:

- Show detail UI includes a share/send action.
- Users can pick an existing conversation or recipient.
- The message includes a useful show preview card.
- Recipients can open the shared show.

### 6. Support video posts

Labels: `priority: medium`, `type: feature`, `area: feed`, `area: profile`

Users should be able to post videos, likely as external links based on earlier product decisions.

Acceptance criteria:

- Users can add supported external video links to posts.
- Video previews render consistently.
- Users can choose or display a cover image when supported.
- Invalid or unsupported video URLs are handled gracefully.

### 7. Connect projects to Industry Now listings

Labels: `priority: high`, `type: feature`, `area: projects`, `area: industry-now`

Project managers should be able to create an Industry Now extension/listing from a running project and reuse the relevant project information.

Acceptance criteria:

- Eligible project managers can start an Industry Now listing from a project.
- Relevant title, dates, description, media, team, and links are copied or prefilled.
- The listing can be edited before publishing.
- Permissions prevent non-managers from publishing project-linked listings.

### 8. Clean margins and responsive layout across desktop and mobile

Labels: `priority: high`, `type: cleanup`, `area: mobile`

Several pages need margin and spacing cleanup on desktop and phone.

Acceptance criteria:

- Identify the highest-traffic pages with visible spacing issues.
- Fix layout regressions without changing product behavior.
- Verify desktop and mobile widths.
- Add before/after screenshots to the PR.

### 9. Verify full credit claiming flow

Labels: `priority: high`, `type: bug`, `area: projects`, `area: profile`, `area: supabase`

Credit claiming should work from email invite to accepted credit appearing on a user's profile.

Acceptance criteria:

- Project credit invite email sends correctly.
- Invite link works for new and existing users.
- Accepted credits appear under the user's profile credits.
- Duplicate or expired invite behavior is clear.
- RLS prevents claiming someone else's invite.

### 10. Build a general invite-a-friend system

Labels: `priority: high`, `type: feature`, `area: messaging`, `area: projects`

Users should be able to invite someone to Inlight generally or invite someone to a project credit/role.

Acceptance criteria:

- Users can send a general invite from an agreed location.
- Project managers can send project-specific invites.
- Invite notifications appear in the recipient inbox when applicable.
- Email copy distinguishes general invites from project/credit invites.
- Existing invite flows remain compatible.

### 11. Restrict signup email policy to `nyu.edu`

Labels: `priority: medium`, `type: bug`, `area: auth`, `area: supabase`

The product note asks to change the `.edu` rule to `nyu.edu`.

Acceptance criteria:

- Signup validation allows the intended NYU domain.
- Rejected email domains receive clear copy.
- Invite-based exceptions still behave as designed.
- Frontend policy and Supabase RPC/policy logic match.

### 12. Clean up Services tab posting

Labels: `priority: medium`, `type: bug`, `area: feed`

The Services tab is described as messy and posting is weird.

Acceptance criteria:

- Audit current Services posting flow.
- Define expected post types and required fields.
- Fix confusing form behavior and display bugs.
- Existing service posts render correctly.

### 13. Fix New Project button destination from profile

Labels: `priority: medium`, `type: bug`, `area: profile`, `area: projects`

The New Project button on profile leads to the wrong place.

Acceptance criteria:

- Button routes to the intended project creation page.
- Auth and onboarding gates still apply.
- The return path after creation is sensible.

### 14. Support recurring or multi-date event posts

Labels: `priority: medium`, `type: feature`, `area: events`, `area: industry-now`

Events should support more than one date or a recurring series.

Acceptance criteria:

- Data model supports multiple dates or recurrence rules.
- UI can create and display recurring events.
- Past dates do not keep ticket/RSVP actions active.
- Filters and sorting use the next upcoming occurrence.

### 15. Clarify Industry Now voting/saves ranking

Labels: `priority: medium`, `type: feature`, `area: industry-now`

The voting system needs to be clearer, with save count influencing which shows appear first.

Acceptance criteria:

- Ranking logic is defined and implemented.
- Save/vote affordance is visually clear.
- Sort order is predictable and documented in code or PR notes.

### 16. Make reviews/community tips more inviting

Labels: `priority: medium`, `type: feature`, `area: industry-now`

Replace or evolve "Community tips" into a more inviting review/conversation section for shows.

Acceptance criteria:

- Show detail pages support a threaded or ledger-like discussion.
- Users can leave reviews/comments.
- Moderation and delete behavior are defined.
- Empty state invites participation.

### 17. Add showcases, cabarets, and readings to Industry Now

Labels: `priority: low`, `type: feature`, `area: industry-now`

Explore or add a place for showcases, cabarets, and readings.

Acceptance criteria:

- Decide whether this is a new page/category or part of community content.
- Add navigation/filtering if implemented.
- Seed or document example data needs.

### 18. Add rehearsal spaces to Resources

Labels: `priority: medium`, `type: feature`, `area: resources`

Resources should include rehearsal spaces.

Acceptance criteria:

- Add rehearsal space category/data model support.
- Display spaces in Resources with location and relevant details.
- Admins can manage entries if resource management exists for other categories.

### 19. Define public profile versus creator account permissions

Labels: `priority: high`, `type: feature`, `area: auth`, `area: profile`

Clarify what public users can do versus creators/full-platform users.

Acceptance criteria:

- Document desired permission tiers.
- Implement or update gating for buying, reviewing, viewing, posting, and creator-only actions.
- UI explains locked actions clearly.
- RLS matches frontend gating.

### 20. Add affiliation request flow

Labels: `priority: low`, `type: feature`, `area: auth`, `area: admin`

Add "Is your affiliation not listed? Request to add it as an official category on Inlight."

Acceptance criteria:

- Users can request an affiliation.
- Admins can view and resolve requests.
- Approved affiliations become selectable where relevant.

### 21. Add "How to get involved" to company accounts

Labels: `priority: medium`, `type: feature`, `area: company`

Company accounts must include a filled-out "How to get involved" section.

Acceptance criteria:

- Company edit flow requires or strongly prompts this field.
- Public company pages display it clearly.
- Existing companies without the field have an empty-state or admin prompt.

### 22. Archive streaming/major artist tabs for now

Labels: `priority: low`, `type: cleanup`, `area: industry-now`

Temporarily archive the streaming tab for film and major artist show data to focus on local, indie, and university communities.

Acceptance criteria:

- Remove or hide streaming/major-artist surfaces from primary navigation.
- Existing data is not deleted unless explicitly approved.
- Film emphasizes festivals and independent films.

### 23. Add save icons consistently

Labels: `priority: medium`, `type: feature`, `area: feed`

Add save icons for everything users are expected to save.

Acceptance criteria:

- Define saveable content types.
- Save/unsave states are visually consistent.
- Saved items appear in the Saves area where appropriate.

### 24. Fix event click routing to blank pages

Labels: `priority: high`, `type: bug`, `area: events`, `area: feed`

Clicking an event can route to a blank page, especially from the All tab.

Acceptance criteria:

- Event cards route to valid detail views.
- Missing/deleted events show a useful not-found state.
- All-tab and event-tab click behavior match.

### 25. Send email daily summaries

Labels: `priority: low`, `type: feature`, `area: messaging`, `area: notifications`

Users should receive daily email summaries instead of noisy individual email flows where appropriate.

Acceptance criteria:

- Define summary contents.
- Add unsubscribe or preference behavior if required.
- Send summary through the chosen email function/provider.

### 26. Improve application receiving and review

Labels: `priority: high`, `type: feature`, `area: opportunities`, `area: projects`

Project/job owners need a cleaner way to receive and review applications.

Acceptance criteria:

- Owners can view applications privately under the relevant project or opportunity.
- Application status is clear.
- Accepting an application can add the user to the project team where intended.
- Applicants can attach their profile.

### 27. Admin dashboard mobile support

Labels: `priority: medium`, `type: bug`, `area: admin`, `area: mobile`

The admin dashboard does not appear correctly on phones.

Acceptance criteria:

- Admin route is usable at mobile widths.
- Tables or cards adapt without horizontal breakage.
- Admin-only access remains intact.

### 28. Add photos to "Why I started"

Labels: `priority: low`, `type: feature`, `area: profile`

The "Why I started" profile section should support photos.

Acceptance criteria:

- Users can add images to the section.
- Images render on the public profile.
- Upload permissions and size/type handling match other profile media.

### 29. Show saved shows on profiles

Labels: `priority: medium`, `type: feature`, `area: profile`, `area: industry-now`

Saved shows should appear on user profiles as a Letterboxd-style element.

Acceptance criteria:

- Users can choose whether saved shows appear publicly if privacy is needed.
- Profile displays saved shows cleanly.
- Empty state is polished.

### 30. Fix movie link opening

Labels: `priority: medium`, `type: bug`, `area: industry-now`

Movie links are not opening correctly.

Acceptance criteria:

- Film/movie cards open the intended detail or external URL.
- Invalid URLs fail safely.
- Behavior is tested from list and detail contexts.

### 31. Disable RSVP after user already RSVPs

Labels: `priority: medium`, `type: bug`, `area: events`

The RSVP button should be unavailable once a user has already RSVPed.

Acceptance criteria:

- RSVP state is visible on event cards/detail.
- Duplicate RSVP attempts are blocked in UI and database.
- Users receive clear feedback.

### 32. RSVP profiles should open user profiles

Labels: `priority: low`, `type: bug`, `area: events`, `area: profile`

Profiles shown in RSVP contexts should link to the user's profile.

Acceptance criteria:

- RSVP attendee cards open `/profile/:userId`.
- Missing profile data has a graceful fallback.

### 33. Add verified credit/vouch system

Labels: `priority: high`, `type: feature`, `area: profile`, `area: projects`

Users should get verified credits when team members vouch for each other. Teams with three or more people require each member to validate the others before a credit is verified.

Acceptance criteria:

- Define verified credit rules.
- Add UI for requesting and submitting vouches.
- Store verification state.
- Display verified credits distinctly on profiles.

### 34. Make project/profile sections collapsible

Labels: `priority: low`, `type: cleanup`, `area: profile`, `area: projects`

Project roles and profile sections should be collapsible to reduce page length.

Acceptance criteria:

- Long sections can collapse/expand.
- State is accessible and mobile-friendly.
- Important calls to action remain discoverable.

### 35. Add project archive

Labels: `priority: medium`, `type: feature`, `area: projects`, `area: industry-now`

Support archived projects, potentially including Broadway or public historical projects.

Acceptance criteria:

- Define archive status and visibility.
- Archived projects are separated from active work.
- Existing links remain valid.

### 36. Remove redundant profile actions and settings UI

Labels: `priority: low`, `type: cleanup`, `area: profile`

Clean up report/block buttons, redundant gear controls, and cramped typing areas where they are not useful.

Acceptance criteria:

- Self-report/block actions are unavailable.
- Settings controls are not duplicated.
- Text input areas have enough room.

### 37. Add map/browse-by-city later

Labels: `priority: low`, `type: feature`, `area: discovery`

Later, after scaling users in different locations, add map or city browsing.

Acceptance criteria:

- Define required location data.
- Add browse-by-city UX.
- Protect user privacy for exact locations.

### 38. Fix password reset loop on login

Labels: `priority: urgent`, `type: bug`, `area: auth`, `area: supabase`

Some users must reset their password every time they log in even when reusing the same password.

Acceptance criteria:

- Affected users can log in repeatedly without being forced through password reset.
- Password recovery, email confirmation, and session refresh flows are audited together.
- Clear error messages appear for invalid credentials versus expired recovery links.
- Supabase auth settings and app-side auth guards are documented in the PR.

### 39. Investigate duplicate account creation

Labels: `priority: high`, `type: bug`, `area: auth`, `area: supabase`

Some users have inadvertently created two accounts.

Acceptance criteria:

- Identify how duplicate accounts are created.
- Prevent duplicate accounts for the same normalized email.
- Define a safe admin cleanup or merge path for existing duplicates.
- Confirm invites, credits, messages, and projects attach to the intended account.

### 40. Fix newly created accounts not appearing on the platform

Labels: `priority: high`, `type: bug`, `area: auth`, `area: profile`, `area: supabase`

Recently created accounts are not appearing in the expected platform surfaces.

Acceptance criteria:

- New signup creates or links the required profile row.
- New profiles appear in People/search where visibility rules allow.
- Hidden/incomplete profile states are intentional and explained in UI.
- RLS policies do not accidentally hide valid new users from themselves or allowed viewers.

### 41. Remove visible test users from production surfaces

Labels: `priority: medium`, `type: cleanup`, `area: profile`, `area: people`

Test user accounts are still visible on the platform.

Acceptance criteria:

- Identify test/demo/filler users currently visible in production.
- Hide, archive, or delete test users according to an approved cleanup plan.
- Add a repeatable rule for excluding test users from public People/profile surfaces.
- Confirm real user accounts are not removed.

### 42. Fix Music tab listing RLS failure

Labels: `priority: urgent`, `type: bug`, `area: industry-now`, `area: supabase`

Posting a new listing on the Music tab in Industry Now can fail with a row-level security policy error.

Acceptance criteria:

- Authorized users can create Music listings.
- Unauthorized users are blocked with a clear message.
- RLS insert/update policies match the frontend create-listing path.
- Theatre, film, and music listing creation paths are regression-tested together.

### 43. Fix admin creation and assignment for groups and companies

Labels: `priority: high`, `type: bug`, `area: admin`, `area: company`, `area: supabase`

Groups and companies cannot be created from the Inlight admin account or assigned to users.

Acceptance criteria:

- Admin users can create groups and companies from the intended admin UI.
- Admin users can assign users to groups/companies with the correct role.
- Non-admin users cannot use admin-only creation or assignment functions.
- RLS and RPC grants match the admin UI behavior.

### 44. Fix inconsistent posting permissions across accounts

Labels: `priority: high`, `type: bug`, `area: feed`, `area: supabase`

Posting does not work consistently across all accounts.

Acceptance criteria:

- Define which account types can post each content type.
- Audit failing accounts against profile, company, and role state.
- Posting forms show clear permission or validation errors.
- RLS policies and frontend gates agree.

### 45. Fix save-to-profile and send-via-message actions

Labels: `priority: high`, `type: bug`, `area: profile`, `area: messaging`, `area: supabase`

Items cannot reliably be saved to profile Saves or sent through internal messaging.

Acceptance criteria:

- Save/unsave works for all intended saveable item types.
- Saved items appear in the user's Saves/profile area.
- Send/share through internal messaging succeeds for supported item types.
- Failures show useful messages and do not create duplicate records.

### 46. Support profile title and affiliation editing

Labels: `priority: high`, `type: bug`, `area: profile`

Users cannot add a title or affiliation to their profile.

Acceptance criteria:

- Users can add, edit, and clear profile title.
- Users can add, edit, and clear affiliation according to product rules.
- Profile display and edit forms use the same field names and validation.
- Changes persist after refresh.

### 47. Generate or prefill bios for new accounts

Labels: `priority: medium`, `type: feature`, `area: profile`

New accounts do not receive an automatically generated or pre-filled bio.

Acceptance criteria:

- Define the default bio source or generation rules.
- New users see a helpful starting bio or empty-state prompt.
- Users can edit or remove generated content.
- No private onboarding data is exposed publicly by default.

### 48. Fix Offer a Service button on the You tab

Labels: `priority: high`, `type: bug`, `area: profile`, `area: feed`

The Offer a Service button on the You tab is not clickable.

Acceptance criteria:

- Button is clickable on desktop and mobile.
- Button opens the intended service creation flow.
- Disabled/loading states are visually clear if the user cannot post services.
- Created service appears in the expected feed/profile surface.

### 49. Fix Add Credit project-name field glitches

Labels: `priority: medium`, `type: bug`, `area: projects`, `area: profile`

The project name field glitches under the Add Credit tab.

Acceptance criteria:

- Project name input supports typing, selection, and clearing without visual glitches.
- Existing projects can be selected where intended.
- New/manual project names are handled according to product rules.
- Validation messages are clear.

### 50. Fix credit invitation acceptance from project creation and edit views

Labels: `priority: high`, `type: bug`, `area: projects`, `area: profile`, `area: supabase`

Accepting a credit invitation does not work from the Add Role section in project creation or from the edit view of a posted project.

Acceptance criteria:

- Credit invitations can be accepted from project creation Add Role.
- Credit invitations can be accepted from posted-project edit view.
- Accepted credit appears on the user's profile.
- Duplicate, expired, or unauthorized invitation attempts fail safely.

### 51. Fix project creation from profile and Projects tab

Labels: `priority: high`, `type: bug`, `area: projects`, `area: profile`

Users cannot reliably add or create projects from profile, and the Projects tab creation flow also fails for some users.

Acceptance criteria:

- Create Project from profile opens the correct route.
- Create Project from the Projects tab opens the correct route.
- Created projects are owned by or associated with the correct user.
- Users are redirected to a useful project page after save.

### 52. Simplify post image creation fields

Labels: `priority: medium`, `type: cleanup`, `area: feed`, `area: media`

The header image field should be removed from post creation.

Acceptance criteria:

- Remove the header image input from post creation if no longer part of the product model.
- Existing posts with header images continue to render or migrate gracefully.
- Form validation and preview do not reference removed fields.

### 53. Support multiple post images and accurate image previews

Labels: `priority: high`, `type: feature`, `area: feed`, `area: media`

Post creation should allow multiple images, accept reasonable dimensions/types, and preview the final posted crop/layout accurately.

Acceptance criteria:

- Users can attach multiple images to a post where supported.
- Image type and dimension rules match product expectations.
- Preview accurately reflects the posted layout.
- Upload errors explain size, type, or permission problems.

### 54. Fix collaborator and friend invite errors

Labels: `priority: high`, `type: bug`, `area: messaging`, `area: projects`, `area: supabase`

Inviting collaborators by email from Make a Post or Projects returns an error, and inviting friends can also show an error.

Acceptance criteria:

- Collaborator invite by email works from supported post/project flows.
- Friend invite works from the intended invite surface.
- Existing users and new email recipients both receive the right invite path.
- Errors are logged server-side and shown clearly in UI.

### 55. Fix image rendering dimensions across media surfaces

Labels: `priority: medium`, `type: bug`, `area: media`, `area: profile`, `area: feed`

Images do not load correctly because dimensions do not encompass the full image, and only certain image types are accepted.

Acceptance criteria:

- Uploaded images render without unexpected cropping in major surfaces.
- Supported image types are defined and enforced consistently.
- Profile, company, post, and project images use appropriate object-fit/crop behavior.
- Broken images have graceful fallbacks.

### 56. Fix bottom navigation responsiveness

Labels: `priority: high`, `type: bug`, `area: mobile`

Bottom navigation buttons are not responsive and may require multiple clicks to navigate.

Acceptance criteria:

- Bottom nav buttons respond to a single tap on mobile.
- Active, hover, focus, and disabled states remain accessible.
- No invisible overlay blocks clicks.
- Navigation works across the primary app routes.

### 57. Clean Resources and People page layout

Labels: `priority: medium`, `type: cleanup`, `area: resources`, `area: people`, `area: mobile`

Resources page margins are off, People page layout appears lopsided, and some People profile cards are larger than others.

Acceptance criteria:

- Resources page has consistent desktop and mobile margins.
- People page grid aligns cleanly at common breakpoints.
- Profile cards have consistent sizing rules.
- Long names, affiliations, and images do not break the layout.

## Lower-confidence notes to clarify before issue creation

- "Add matchmaking thing at the bottom?"
- "What about shopping an idea - like a script - like a review system"
- "Difference between job page and projects"
- "Other word for completed projects"
- "Guided instructions?"
- "About page at the top"
- "Add map - As in browsing by city...?"

These should become issues only after a short product decision.
