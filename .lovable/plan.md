# Replace landing page with scrollytelling design

## Files to create

1. **`src/components/Sparkle.tsx`** — paste as-is from upload.
2. **`src/components/Starfield.tsx`** — paste as-is from upload.
3. **`src/components/scrollytelling.tsx`** — paste from upload, with these adjustments:
   - Change `import logo from "@/assets/inlight-logo.png"` → `"@/assets/inlight-logo.jpeg"`
   - Replace the 6 missing image imports (`audience-1`, `audience-2`, `community`, `winner`, `panel`, `collage`) with newly generated assets (see step 5).
   - Wire `CTAStop`'s Create-account / Log-in buttons to navigate to `/auth` via `useNavigate` (project's real auth lives there; we keep the visual form but the submit button routes to `/auth` instead of hitting Supabase, per "don't touch auth files").

## File to replace

4. **`src/pages/LandingPage.tsx`** — replace entirely with adapted `index.tsx`:
   - Drop `createFileRoute` + `Route` export (routing is in `App.tsx`); export default `LandingPage` so `Index.tsx` keeps working.
   - `import { Link } from "@tanstack/react-router"` → `"react-router-dom"`; the `/preview` link points to `/auth` (no preview route exists).
   - "Sign in" anchor `href="#cta"` stays as in-page scroll.
   - Logo import → `.jpeg`.
   - Move `head()` meta to a small `useEffect` setting `document.title` and meta description (no helmet dep).
   - Keep `Index.tsx` and all auth/Supabase code untouched.

## Dependency

5. `bun add framer-motion`

## Missing Tailwind/CSS tokens

The pasted code uses classes that don't exist in the project: `bg-night`, `bg-aurora`, `text-glow`, `bg-glow`, `shadow-glow`, `shadow-soft`, `border-glow`, `animate-twinkle` (plus `font-display` which already exists). Add these to `src/index.css` under `@layer utilities` using the Deep Space palette already defined (`hsl(45 95% 58%)` gold for glow, deep navy for night, gold-tinted aurora). Add `@keyframes twinkle` for the starfield.

## Missing image assets

The scrollytelling stops reference 6 photos. Generate them with `imagegen` (fast tier, 1024×1024, cinematic dark editorial style matching Deep Space theme) into `src/assets/`:
- `audience-1.jpg`, `audience-2.jpg` — theatre audience
- `community.jpg` — student creative gathering
- `winner.jpg` — award/spotlight moment
- `panel.jpg` — industry panel discussion
- `collage.jpg` — music/film production collage

## Out of scope (per user)

- `src/pages/Index.tsx` untouched → `<LandingPage />` continues to render for logged-out users, redirect-to-`/feed` for logged-in users keeps working.
- No changes to `useAuth`, Supabase client, AuthPage, or any backend files.

## Verification

- Type-check passes.
- `/` (logged out) renders new scrollytelling landing; scroll triggers each stop; "Sign in" scrolls to CTA; CTA form buttons navigate to `/auth`.
- `/` (logged in) still redirects to `/feed`.

## Revertability

Every change is recoverable via chat-history revert or the History tab.
