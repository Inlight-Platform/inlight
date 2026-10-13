# Same-Title Project Links

Project creation returns `id` and `title`, not the stored database slug. The old
link helper fell back to a title-only URL, which could resolve to another user's
older project. New generated project links include the full UUID after the
readable title/slug. The existing detail resolver treats that UUID as authoritative.
Full UUIDs avoid both title ambiguity and short-ID prefix collisions.

This frontend-only fix changes no database slugs, ownership, grants, or policies.
It also updates the feed destination helper to use the same project link format.
Old stored-slug and direct UUID URLs remain supported. Existing ambiguous
title-only links cannot identify which same-title project their sender intended;
open that project from its refreshed card and share the new ID-based link.

## Sandbox Tests

1. As sandbox account A, create a public project with a distinctive test title,
   such as `Duplicate title sandbox test`. Record its project UUID from Network.
2. As a different ordinary account B, create a project with exactly the same
   title through the normal creation flow. It must open B's new project, not A's.
   Its URL must end in B's full UUID. B should retain the normal owner editing
   controls; edits to B's description must not change A's project.
3. Refresh B's new URL, then open it directly in a fresh tab. It must still show
   B's project. The `projects_browse` request must filter by B's `id`, not a
   title-only slug. Confirm it returns B's creator identity when signed in.
4. Open both project cards from Home and the owners' profile project lists.
   Each must resolve to its own UUID. Check Projects, saved-project cards, and
   company project cards where those surfaces are available.
5. Open B's link as unrelated A. Existing access policy should apply; A must
   not gain B's editing rights. Open A's card as A; A's editing still works.
6. Open an existing stored-slug project link and a `/projects/PROJECT_UUID`
   link. Both must still resolve normally. Existing event URLs must remain
   unchanged. Clean up only the two sandbox test projects using normal controls.

## Production Preview

This routing fix adds no migration and is included in PR #159. After sandbox passes,
use PR #159's production-data preview to open existing same-title
projects from their cards, compare URL UUIDs with Network response IDs, refresh,
and check owners/non-owners see the expected controls. Test old slug and UUID
links read-only. Do not create/edit/delete production projects for this test.

PR #159's public-feed security changes retain their existing migration and
confirmation process in `docs/public-feed-security-testing.md`. Follow that
checklist separately; there is no additional migration for project links.
