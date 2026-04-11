

## Plan: Enable Test Mode for Plan Selection Page

Two small changes, scoped to exactly two files.

### 1. `src/pages/AuthPage.tsx` (line 44)
Change the post-login redirect from `navigate('/')` to `navigate('/plan-selection')` so every login goes through the plan selection page.

### 2. `src/pages/PlanSelectionPage.tsx`
- Add a yellow test-mode banner at the top of the page: `"⚠️ TEST MODE — This page is showing on every login for testing purposes only"`
- No other logic changes needed — there is currently no early-exit condition that skips the page based on `plan_type`, so nothing to remove.

### What stays untouched
- Button wiring, edge functions, success/cancel URLs, Stripe integration, signup flow — all unchanged.

