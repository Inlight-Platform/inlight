

## Plan: Post-Signup Plan Selection Interstitial

### Overview
After a new user signs up and is authenticated, show a full-screen plan selection page before they reach the dashboard. Users choose between Pro ($10/mo via Stripe) or Free, and the selection is stored on their profile.

### Database Changes

1. **Add `plan_type` column to `profiles` table**
   - Type: `text`, default `'free'`, not null
   - Stores `'free'` or `'pro'`

2. **Add `stripe_customer_id` column to `profiles` table**
   - Type: `text`, nullable
   - For linking Stripe customer records

### Stripe Setup

3. **Enable the Stripe integration** using the Lovable Stripe tool — this will prompt you for your Stripe secret key if not already configured, and expose Stripe-specific tools for creating products/prices.

4. **Create a "Pro Monthly" product and price** ($10/month) via the Stripe tools after enabling.

### New Components & Pages

5. **Create `src/pages/PlanSelectionPage.tsx`**
   - Full-screen dark page with the app logo centered at top
   - Headline: "Get full access." / Subheadline: "Upgrade for only $10/month — Cancel anytime."
   - Two options side by side (stacked on mobile):
     - **Pro card**: "Popular" badge, 5 bullet features, bold "Upgrade for $10 / mo" button
     - **Free option**: plain text link "Or continue for free" below the Pro card
   - Pro button calls a Stripe Checkout edge function; free link updates `plan_type` to `'free'` and redirects to `/feed`

6. **Create edge function `supabase/functions/create-checkout/index.ts`**
   - Accepts the authenticated user's ID
   - Creates or retrieves a Stripe customer
   - Creates a Stripe Checkout Session for the Pro monthly price
   - Returns the checkout URL

7. **Create edge function `supabase/functions/stripe-webhook/index.ts`**
   - Handles `checkout.session.completed` event
   - Updates the user's `plan_type` to `'pro'` and stores `stripe_customer_id`

### Routing Changes

8. **Add route `/plan-selection`** in `App.tsx` — a protected route (requires auth) but outside the `AppShell` layout (no sidebar/nav).

9. **Modify post-signup redirect** in `AuthPage.tsx`:
   - After successful signup (line 95), navigate to `/plan-selection` instead of `/`
   - Login flow remains unchanged — navigates to `/` as before

10. **Add plan check in `RequireAuth.tsx`** (or Index):
    - After signup, if user's `plan_type` is null (hasn't chosen yet), redirect to `/plan-selection`
    - This handles the Stripe return flow: user pays, gets redirected back, and the webhook sets `plan_type` to `'pro'` — then they proceed to dashboard

### What Will NOT Be Modified
- Signup form, .edu validation, login flow
- Dashboard pages, navigation, sidebar
- No feature gating — just stores the value

### Technical Details
- The `profiles` table already has an `id` and `user_id` column; the new `plan_type` column defaults to `'free'`
- Stripe Checkout handles payment securely server-side via edge functions
- The webhook edge function will need `verify_jwt = false` in config since Stripe calls it directly
- RLS on profiles already allows users to update their own row

