## Messaging System Restructure — Plan

This is a large, multi-part restructure touching the Messages page, Profile page, People page, Project page, and routing. Here is the incremental approach.

---

### Part 1: Restructure /messages page with tabs

**Files modified:** `src/pages/MessagesPage.tsx`

- Inside the `MessagesPage.tsx` UI only, add a `Tabs` component with two tabs: "Direct Messages" and "Group Chats". Do not add any Messages link, icon, or tab to the sidebar navigation — the `/messages` route is only reachable via chat icons on profile pages, project pages, and the People page.
- The "Direct Messages" tab shows the existing DM conversation list (filtered from `allChats` to only `type === 'dm'`)
- The "Group Chats" tab shows only group chats (filtered to `type === 'group'`)
- Remove the `+` / `NewMessageDialog` button from the DM tab header
- Keep `+` button only in the Group Chats tab — clicking opens a new dialog (`NewGroupMessageDialog`) that lists members of the selected group chat who can be messaged
- Add minimize/expand floating chat pattern:
  - New state: `isMinimized` — when true, the chat area collapses to a fixed floating Mail icon button in the bottom-right corner
  - Clicking the floating icon restores the full chat view
  - A minimize button (ChevronDown or Minimize2 icon) appears in the chat header

**New component:** `src/components/messages/FloatingChatButton.tsx`

- A fixed-position button (bottom-right) with a Mail/MessageSquare icon
- Accepts `onClick` to expand the chat
- Shows on messages page when minimized, and on profile/project pages as entry point

**New component:** `src/components/messages/NewGroupMessageDialog.tsx`

- The `+` button is visible to the members of the project
- When the creator clicks `+`, the dialog shows two sections in a single list:
  - **"Chat with member"** — lists current project team members (to start or open a direct chat with them)
  - **"Add new member"** — lists the creator's connections who are not yet in the project chat, allowing them to be added manually (no authentication check needed)
- **Non-creator project members** see the `+` button :
  - **"Chat with member"** — lists current project team members (to start or open a direct chat with them). They can only chat within the existing group — no ability to add new members or start new threads
    &nbsp;

Part 2: DM entry points on Profile and People pages

**File modified:** `src/pages/ProfilePage.tsx`

- Check if viewing another user's profile and if connection status is "connected"
- If connected: render `FloatingChatButton` in bottom-right corner
- On click: `navigate('/messages/direct/${userId}')` which opens the messages page with that DM auto-selected

**File modified:** `src/components/people/PersonCard.tsx`

- The Mail icon button already exists for connected users (`handleMessage`)
- Update `handleMessage` to navigate to `/messages/direct/${userId}` instead of calling `onMessage`
- Only show Mail icon when `connectionStatus === 'connected'` (already the case)

**File modified:** `src/pages/PeoplePage.tsx`

- Remove or simplify the `onMessage` handler passed to PersonCard (navigation now handled inside PersonCard)

### Part 3: Project group chat floating icon

**File modified:** `src/pages/ProjectDetailPage.tsx`

- Check if current user is a project member (already fetched in the page)
- If member: render `FloatingChatButton` in bottom-right
- When a new project is created, automatically create a group chat for it with the project creator as the first and only member by default. If this trigger does not already exist in the project creation flow or database, add it now.
- On click: navigate to `/messages/group/${projectId}`
- Non-members see nothing

### Part 4: Routing and auto-open

**File modified:** `src/App.tsx`

- Add routes: `/messages/direct/:userId` and `/messages/group/:projectId`
- Both render `MessagesPage` component

**File modified:** `src/pages/MessagesPage.tsx`

- Read route params (`useParams`) for `userId` or `projectId`
- On mount, if `userId` param exists: set active tab to "Direct Messages", auto-select that DM conversation
- If `projectId` param exists: set active tab to "Group Chats", look up the group chat for that project, auto-select it
- Handle disconnected users: when a DM is selected, check connection status. If not connected, show the thread read-only with a disabled input and message "You are no longer connected with this person"

### Part 5: Connection-gated messaging

**File modified:** `src/pages/MessagesPage.tsx`

- For DM threads, query connection status between current user and the selected partner
- If not mutually connected: display messages but disable the send input with an explanatory note

---

### Technical details

- **Tabs**: Use existing `@/components/ui/tabs` (Radix Tabs) already in the project
- **Floating button**: A `fixed bottom-6 right-6 z-50` positioned button with shadow, uses Mail icon from lucide-react
- **Route params**: Use `useParams()` from react-router-dom; routes defined as `/messages/direct/:userId` and `/messages/group/:projectId`
- **Connection check for send-gating**: Use `supabase.rpc('get_mutual_connections', { target_user_id: user.id })` and check if the partner is in the result set
- **No database changes required** — When a new project is created, automatically create a group chat for it with the project creator as the first member. If this trigger does not already exist in the database or in the project creation flow, add it now. All tables and triggers other than this already exist.
- **No new hooks needed** — existing `useMessages`, `useGroupChats`, and `useNetworkConnections` cover all data needs

### Files to create

1. `src/components/messages/FloatingChatButton.tsx`
2. `src/components/messages/NewGroupMessageDialog.tsx`

### Files to modify

1. `src/App.tsx` — add sub-routes
2. `src/pages/MessagesPage.tsx` — tabs, minimize pattern, route param handling, connection-gated send
3. `src/pages/ProfilePage.tsx` — floating chat icon for connected users
4. `src/pages/ProjectDetailPage.tsx` — floating chat icon for project members
5. `src/components/people/PersonCard.tsx` — navigate to DM on Mail click