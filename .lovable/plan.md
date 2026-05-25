## 1. MainNav — relocate theme toggle, add Messages item

`src/components/layout/MainNav.tsx`
- Remove the Sun/Moon button from the top logo row (both expanded + collapsed paths).
- Add a "Theme" entry in the bottom user section, sitting immediately above the existing **Settings** row, using the same `Link`-style markup but rendered as a `<button onClick={toggleTheme}>`. Icon is `Sun`/`Moon` based on `isDark`, label "Light mode" / "Dark mode". Mirror the same row in the `collapsed` branch (icon-only with Tooltip). It naturally inherits the collapse behavior.
- Add a new top-level nav item **Messages** (`MessageSquare` icon, path `/messages`) inserted into `navItems` between "Home" and "People".
- Rename `'Pie Chart'` nav item → `'Your Network'` (path unchanged: `/pie-chart`).
- Update the Notifications badge: keep `combinedUnread` for the bell, but also surface `totalUnread` on the new Messages item so the inbox shows its own count.

## 2. Notifications page — drop Messages tab

`src/pages/NotificationsPage.tsx`
- Remove the `Tabs` wrapper and the `messages` tab entirely; render only the notifications list.
- Drop unused imports (`Mail`, `MessageSquare`, message hooks/components, conversation panel, NewMessageDialog wiring).
- Remove the `?tab=messages` URL handling and any code paths that switch to the messages view (notification clicks that previously routed to a thread should `navigate('/messages/direct/<id>')` instead).

## 3. Bento event click → blank page

`src/pages/FeedPage.tsx` (bento `onClick`): events currently navigate to `'/events'`, which renders blank because `EventsPage` expects context/query state from the home shell. Fix by opening the existing detail panel instead — call `setSelectedItem(item)` for `type === 'event'` (matches show/update behaviour), so it opens the same Sheet used by FeedItem.

## 4. Industry Now — reorder + remove promo banner

`src/pages/StageWhisperPage.tsx`
- Delete the `<a href="mailto:info@inlight.social">Build a website…</a>` block (lines ~343–349).
- Reorder the Theatre `TabsList` to: School → Off-Off → Off-Broadway → Broadway. Update the parent `Tabs` `defaultValue` to `"school"`.
- Add **Festivals** as a 4th film subtab: extend the `filmViewTab` union to include `'festivals'`, add the `Button` toggle next to Theatres/Streaming/Student, and add a `{filmViewTab === 'festivals' && …}` block rendering a placeholder grid ("No festivals listed yet") wired through the existing card styling. No DB changes — empty state for now.

## 5. "Your Network" page — replace donut with spiderweb

`src/pages/NetworkPieChartPage.tsx`
- Rename heading to **Your Network**.
- Replace the Recharts `PieChart` block with an inline SVG **constellation/spiderweb** modeled on the Stop 3 schools graphic in `src/components/scrollytelling.tsx`: center node = the current user; outer nodes = each affiliation bucket from `chartData`, positioned around a circle with `cos/sin` math; thin lines connect the center to each node; node radius scales with `value`; same color palette. Keep the breakdown list + suggestions sections below unchanged.
- Keep the existing data queries; only the visualization changes.

## 6. Hide welcome banner for returning users

- Add a small login counter in `src/hooks/useAuth.ts` (or wherever sign-in completes): on successful auth, increment `localStorage['inlight-login-count']`.
- `src/pages/FeedPage.tsx`: only render `<WelcomeMessage />` when `Number(localStorage.getItem('inlight-login-count') ?? 0) <= 2`.

## 7. Bento is default — verify only

`viewMode` already defaults to `'bento'` in `FeedPage.tsx:57`. No change needed; just confirm during QA.

## 8. Page-title font matches Landing/Preview

The landing/preview hero font is `.font-editorial` (Playfair Display) defined in `src/index.css`.
- Add a new Tailwind alias by extending `fontFamily.display` in `tailwind.config.ts` to `['Playfair Display', 'Lora', 'ui-serif', 'Georgia', 'serif']` so every existing `font-display` (already used on most page `<h1>` titles like Insights, Industry Now, Feed) immediately picks up the editorial serif without touching individual pages.
- Spot-check page headers that use a different class (e.g. NetworkPieChartPage `<h1 className="text-2xl font-bold">`) and add `font-display` so they match.

## Technical notes

- Login-count gating is intentionally client-side; no schema change required.
- Festivals tab ships empty; adding real data is a follow-up.
- Pie-chart → spiderweb is purely a presentational swap; the page route `/pie-chart` stays so existing links keep working.
- Changing `font-display` globally shifts the typography of every page header that already uses `font-display` (intentional, matches Landing). Body text, buttons, badges remain on Inter.
