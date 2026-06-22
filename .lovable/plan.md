# Profile page adjustments

All changes are frontend-only in `src/pages/ProfilePage.tsx` and `src/pages/ProfileSettingsPage.tsx`. No schema changes — `profiles.website_url` already exists.

## 1. Move Skills section below Posts
- Cut the Skills `<Collapsible>` block (currently in the LEFT column of the profile header, around lines 1623–1665).
- Re-render it as its own section directly **after** the Posts section (after line ~2160), wrapped in the same rounded card styling used by other sections so it reads as a peer of Posts.
- Keep all existing add/remove handlers (`handleRemoveSkill`, `SkillsCombobox` + `saveProfileField('skills', ...)`) — only the JSX location changes.

## 2. Website link in Settings + under name
- **Settings (`ProfileSettingsPage.tsx`)**: add a "Website" text input in the existing links/contact section (next to Instagram if present, otherwise in the main profile form). On save, write to `profiles.website_url` via the page's existing `saveProfileField` / update pattern. Validate by attempting `new URL(value)` (prepend `https://` if the user omits the scheme); show an inline error and skip save if invalid. Empty string clears the field.
- **Profile (`ProfilePage.tsx`)**: directly below the name block (after the real-name `<div>` around line 1368, before the headline), if `dbProfile?.website_url` is set render:
  ```
  <a href={normalizedUrl} target="_blank" rel="noopener noreferrer"
     className="text-sm italic text-blue-500 hover:underline">
    {displayUrl}
  </a>
  ```
  Show the host + path (strip protocol) for `displayUrl`. Visible on both own and others' profiles. No edit affordance here — editing happens in Settings.

## 3. Remove hashtags on the profile
- In the Affiliation badges render (line ~1579), drop the leading `#`: render `{badge}` instead of `#{badge}`.
- In the Affiliation dropdown menu items (line ~1609), drop the `#` as well: render `{option.tag}` instead of `#{option.tag}`.
- No other behavior changes — affiliations still add/remove the same way.

## 4. Move Profile Completion bar to bottom
- Remove the `<ProfileCompletionBar>` block currently at lines 1283–1302 (top of the page, above the profile card).
- Re-render the same component at the very bottom of the profile content, after the (newly relocated) Skills section, still gated on `isOwnProfile && dbProfile`. Pass the same props.

## Files touched
- `src/pages/ProfilePage.tsx`
- `src/pages/ProfileSettingsPage.tsx`

No new dependencies, no DB migration, no changes to business logic.
