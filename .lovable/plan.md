
## Plan: Add image + hyperlink to job opportunities

### Database
Add two columns to `opportunities` table via migration:
- `image_url text` (nullable)
- `link_url text` (nullable)
- `link_title text` (nullable, for the displayed CTA label)

### OpportunityCreator (`src/components/opportunities/OpportunityCreator.tsx`)
- Add an **Image** section using the existing `ImageUploader` component (same as feed posts), available to any user posting (works for Inlight admin and everyone else).
- Add **Link URL** + **Link Title** input fields (optional).
- Pass `image_url`, `link_url`, `link_title` into `createOpportunity.mutate()`.

### useOpportunities hook (`src/hooks/useOpportunities.ts`)
- Extend `DBOpportunity` and `OpportunityView` types with the three new fields.
- Map them in `toView()`.
- Include them in the `createOpportunity` and `updateOpportunity` mutations.

### OpportunityCard (`src/components/opportunities/OpportunityCard.tsx`)
- If `imageUrl` is present, render it as a banner above the card header (16:9, object-cover).
- If `linkUrl` is present, render a secondary outline button "{linkTitle || 'Visit Link'}" next to Apply that opens the URL in a new tab.

### EditOpportunityDialog
- Add the same image + link fields so posts can be updated after creation.

### OpportunityDetailSheet
- Display the image (full width) and the link button inside the detail view.

### Notes
- Image uploads use the existing `profile-media` bucket via `ImageUploader` — no new storage needed.
- Available to all users (not gated to Inlight only) since the request mentioned Inlight as the use case but the column-level approach makes it universal.

Files touched:
- New migration adding 3 columns
- `src/hooks/useOpportunities.ts`
- `src/components/opportunities/OpportunityCreator.tsx`
- `src/components/opportunities/OpportunityCard.tsx`
- `src/components/opportunities/EditOpportunityDialog.tsx`
- `src/components/opportunities/OpportunityDetailSheet.tsx`
