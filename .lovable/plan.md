

## Messaging Fix & Refinement Plan

### FIX 1 — Minimize navigates back to originating page with floating bubble

**Approach**: Use a global lightweight state (React context or a tiny zustand slice) to track the "active minimized chat" across pages. When minimizing, navigate back to the originating route. The floating bubble renders conditionally on Profile/Project pages when this state is active.

**Files modified:**
- **New: `src/hooks/useMinimizedChat.ts`** — A zustand store (or simple context) holding `{ originRoute: string | null, chatRoute: string | null, isMinimized: boolean }`. Actions: `minimize(originRoute, chatRoute)`, `expand()`, `close()`.
- **`src/pages/MessagesPage.tsx`** — On minimize click: call `minimize(originRoute, currentChatRoute)` then `navigate(originRoute)`. Remove the current "return blank page with FloatingChatButton" logic. Read `originRoute` from a query param or location state passed when navigating to `/messages`.
- **`src/pages/ProfilePage.tsx`** — Pass `location.pathname` as state when navigating to `/messages/direct/:id`. Render `FloatingChatButton` if `useMinimizedChat().isMinimized` is true AND current path matches the stored origin. On click, navigate to stored `chatRoute`. On route change away from origin, call `close()`.
- **`src/pages/ProjectDetailPage.tsx`** — Same pattern as ProfilePage.
- **`src/components/messages/FloatingChatButton.tsx`** — No changes needed (already a simple presentational component).

**Behavior**: Navigating to any page other than the origin clears the minimized state entirely (bubble disappears). This is enforced via a `useEffect` in the originating pages that checks if the current path still matches.

---

### FIX 2 — Replace email input with structured + dialog

**File modified: `src/components/messages/NewGroupMessageDialog.tsx`**

The current component already has the right structure (two sections: "Chat with member" and "Add new member") but may have issues. This fix:
- Removes any manual email input field
- **"Add new member"** section: Lists creator's connections not in the group chat, each with an "Add" button. Visible only to project creator.
- **"Chat privately with"** section: Lists current group members (excluding self), each with a "Message" button. Clicking navigates to `/messages/direct/:memberId`. Visible to all members.
- Non-creators see only the "Chat privately with" section.
- Ensure the `+` button is only visible to the creator in the group chat header, but the dialog content differs based on role.

Actually, re-reading the plan: the `+` button should be visible to ALL project members, but non-creators only see "Chat privately with" section. Let me check the current implementation more carefully.

The current `NewGroupMessageDialog` already has both sections and already gates "Add new member" to creator only. The "Chat with member" section navigates to `/messages/direct/:userId`. This looks mostly correct already. The fix is to:
1. Ensure no email input exists (it doesn't in the current code — good)
2. Make the `+` button visible to all members (currently it's rendered in MessagesPage without a creator check, so it's visible to all — good)
3. Relabel sections to match spec: "Chat privately with" and "Add new member"

---

### FIX 3 — Remove Messages tab from NotificationsPage

**File modified: `src/pages/NotificationsPage.tsx`**

- Remove the "Messages" `TabsTrigger` (line 150-157)
- Remove the entire `TabsContent value="messages"` block (lines 253-335)
- Remove unused imports: `useMessages`, `useGroupChats`, `NewMessageDialog`, `GroupChatItem`, `parseSharedItem`, `MessageSquare`, and related variables (`conversations`, `loadingConversations`, `totalUnread`, `groupChats`, `loadingGroupChats`, `allChats`, `handleNewMessage`)

---

### FIX 4 — Context-filtered messages view (no tabs UI)

**File modified: `src/pages/MessagesPage.tsx`**

- Remove the `Tabs` / `TabsList` / `TabsTrigger` UI entirely from both desktop and mobile layouts
- When `routeProjectId` is set: show only the group chat for that project plus any DM threads associated with project members (or just the group chat thread directly — auto-selected)
- When `routeUserId` is set: show only the DM thread with that user — auto-selected, no sidebar list needed
- When neither param exists (`/messages` bare): redirect to the most recently active conversation, or show an empty state
- The sidebar list is unnecessary in the context-filtered view since only one conversation is shown. Simplify to just render the chat area directly.

**Implementation**: 
- If `routeUserId`: immediately select that DM, render chat area only (no sidebar)
- If `routeProjectId`: find group chat for that project, render group chat thread only (no sidebar)  
- If neither: redirect to most recent conversation or show empty state with message "Open a chat from a profile or project page"

---

### Summary of files

| Action | File |
|--------|------|
| Create | `src/hooks/useMinimizedChat.ts` |
| Modify | `src/pages/MessagesPage.tsx` |
| Modify | `src/pages/ProfilePage.tsx` |
| Modify | `src/pages/ProjectDetailPage.tsx` |
| Modify | `src/pages/NotificationsPage.tsx` |
| Modify | `src/components/messages/NewGroupMessageDialog.tsx` |

No database changes required.

