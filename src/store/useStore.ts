import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'Actor' | 'Producer' | 'Director' | 'Musician';
export type ConnectionStatus = 'pending' | 'accepted';
export type Visibility = 'public' | 'connections' | 'private';
export type StoryType = 'image' | 'video';

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
}

export interface Thread {
  id: string;
  participants: string[];
  lastMessageAt: string;
  typingUserId?: string;
}

export interface Story {
  id: string;
  userId: string;
  type: StoryType;
  url: string;
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewedBy: string[];
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  coverImage: string;
  role: UserRole;
  location: string;
  pronouns: string;
  bio: string;
  badges: string[];
  unionStatus: string;
  representation: string;
  availability: string[];
  gearList: string[];
  lastPostDates: string[];
}

export interface Material {
  id: string;
  userId: string;
  type: 'photo' | 'reel' | 'resume' | 'audio';
  url: string;
  name: string;
  visibility: Visibility;
  order: number;
  createdAt: string;
}

export interface Credit {
  id: string;
  userId: string;
  project: string;
  role: string;
  year: number;
  company: string;
  verified: boolean;
}

export interface Connection {
  id: string;
  userAId: string;
  userBId: string;
  status: ConnectionStatus;
  createdAt: string;
}

interface AppState {
  currentUserId: string;
  users: User[];
  materials: Material[];
  credits: Credit[];
  connections: Connection[];
  stories: Story[];
  messages: Message[];
  threads: Thread[];
  
  // Actions
  setCurrentUser: (id: string) => void;
  getUser: (id: string) => User | undefined;
  getCurrentUser: () => User | undefined;
  
  // Badge actions
  addBadge: (userId: string, badge: string) => void;
  removeBadge: (userId: string, badge: string) => void;
  getUsersByBadge: (badge: string) => User[];
  
  // Connection actions
  sendConnectionRequest: (toUserId: string) => void;
  acceptConnection: (connectionId: string) => void;
  getConnectionStatus: (userId: string) => ConnectionStatus | null;
  getConnections: (userId: string) => User[];
  get1stDegree: (userId: string) => User[];
  get2ndDegree: (userId: string) => User[];
  get3rdDegree: (userId: string) => User[];
  getMutualCount: (userId: string) => number;
  
  // Material actions
  addMaterial: (material: Omit<Material, 'id' | 'createdAt'>) => void;
  updateMaterialOrder: (materialId: string, newOrder: number) => void;
  updateMaterialVisibility: (materialId: string, visibility: Visibility) => void;
  getMaterials: (userId: string, type?: Material['type']) => Material[];
  
  // Credit actions
  addCredit: (credit: Omit<Credit, 'id'>) => void;
  requestCreditVerification: (creditId: string) => void;
  getCredits: (userId: string) => Credit[];
  
  // Streak
  getStreak: (userId: string) => number;
  addPostDate: (userId: string, date: string) => void;
  
  // Story actions
  addStory: (story: Omit<Story, 'id' | 'createdAt'>) => void;
  getActiveStories: (userId: string) => Story[];
  getAllActiveStories: () => Story[];
  markStoryViewed: (storyId: string, viewerId: string) => void;
  cleanupExpiredStories: () => void;
  
  // Message actions
  getOrCreateThread: (userAId: string, userBId: string) => Thread;
  getThread: (threadId: string) => Thread | undefined;
  getUserThreads: (userId: string) => Thread[];
  sendMessage: (threadId: string, senderId: string, content: string) => void;
  getMessages: (threadId: string) => Message[];
  markMessagesRead: (threadId: string, readerId: string) => void;
  setTyping: (threadId: string, userId: string | undefined) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: 'user-1',
      users: [],
      materials: [],
      credits: [],
      connections: [],
      stories: [],
      messages: [],
      threads: [],
      
      setCurrentUser: (id) => set({ currentUserId: id }),
      
      getUser: (id) => {
        const state = get();
        if (id === 'me') return state.users.find(u => u.id === state.currentUserId);
        return state.users.find(u => u.id === id);
      },
      
      getCurrentUser: () => {
        const state = get();
        return state.users.find(u => u.id === state.currentUserId);
      },
      
      addBadge: (userId, badge) => {
        const normalizedBadge = badge.toLowerCase().replace(/[^a-z0-9-]/g, '');
        set(state => ({
          users: state.users.map(u => 
            u.id === userId && !u.badges.includes(normalizedBadge)
              ? { ...u, badges: [...u.badges, normalizedBadge] }
              : u
          )
        }));
      },
      
      removeBadge: (userId, badge) => {
        set(state => ({
          users: state.users.map(u => 
            u.id === userId
              ? { ...u, badges: u.badges.filter(b => b !== badge) }
              : u
          )
        }));
      },
      
      getUsersByBadge: (badge) => {
        return get().users.filter(u => u.badges.includes(badge.toLowerCase()));
      },
      
      sendConnectionRequest: (toUserId) => {
        const state = get();
        const existingConnection = state.connections.find(
          c => (c.userAId === state.currentUserId && c.userBId === toUserId) ||
               (c.userBId === state.currentUserId && c.userAId === toUserId)
        );
        
        if (existingConnection) return;
        
        set(state => ({
          connections: [...state.connections, {
            id: `conn-${Date.now()}`,
            userAId: state.currentUserId,
            userBId: toUserId,
            status: 'pending',
            createdAt: new Date().toISOString()
          }]
        }));
      },
      
      acceptConnection: (connectionId) => {
        set(state => ({
          connections: state.connections.map(c =>
            c.id === connectionId ? { ...c, status: 'accepted' as ConnectionStatus } : c
          )
        }));
      },
      
      getConnectionStatus: (userId) => {
        const state = get();
        const connection = state.connections.find(
          c => (c.userAId === state.currentUserId && c.userBId === userId) ||
               (c.userBId === state.currentUserId && c.userAId === userId)
        );
        return connection?.status ?? null;
      },
      
      getConnections: (userId) => {
        const state = get();
        const connectedIds = state.connections
          .filter(c => c.status === 'accepted' && (c.userAId === userId || c.userBId === userId))
          .map(c => c.userAId === userId ? c.userBId : c.userAId);
        return state.users.filter(u => connectedIds.includes(u.id));
      },
      
      get1stDegree: (userId) => {
        return get().getConnections(userId);
      },
      
      get2ndDegree: (userId) => {
        const state = get();
        const firstDegree = state.get1stDegree(userId);
        const firstDegreeIds = new Set(firstDegree.map(u => u.id));
        firstDegreeIds.add(userId);
        
        const secondDegreeIds = new Set<string>();
        firstDegree.forEach(friend => {
          state.getConnections(friend.id).forEach(friendOfFriend => {
            if (!firstDegreeIds.has(friendOfFriend.id)) {
              secondDegreeIds.add(friendOfFriend.id);
            }
          });
        });
        
        return state.users.filter(u => secondDegreeIds.has(u.id));
      },
      
      get3rdDegree: (userId) => {
        const state = get();
        const firstDegree = state.get1stDegree(userId);
        const secondDegree = state.get2ndDegree(userId);
        const excludedIds = new Set([userId, ...firstDegree.map(u => u.id), ...secondDegree.map(u => u.id)]);
        
        const thirdDegreeIds = new Set<string>();
        secondDegree.forEach(friend => {
          state.getConnections(friend.id).forEach(friendOfFriend => {
            if (!excludedIds.has(friendOfFriend.id)) {
              thirdDegreeIds.add(friendOfFriend.id);
            }
          });
        });
        
        return state.users.filter(u => thirdDegreeIds.has(u.id));
      },
      
      getMutualCount: (userId) => {
        const state = get();
        const myConnections = new Set(state.get1stDegree(state.currentUserId).map(u => u.id));
        const theirConnections = state.get1stDegree(userId);
        return theirConnections.filter(u => myConnections.has(u.id)).length;
      },
      
      addMaterial: (material) => {
        set(state => ({
          materials: [...state.materials, {
            ...material,
            id: `mat-${Date.now()}`,
            createdAt: new Date().toISOString()
          }]
        }));
      },
      
      updateMaterialOrder: (materialId, newOrder) => {
        set(state => ({
          materials: state.materials.map(m =>
            m.id === materialId ? { ...m, order: newOrder } : m
          )
        }));
      },
      
      updateMaterialVisibility: (materialId, visibility) => {
        set(state => ({
          materials: state.materials.map(m =>
            m.id === materialId ? { ...m, visibility } : m
          )
        }));
      },
      
      getMaterials: (userId, type) => {
        const state = get();
        return state.materials
          .filter(m => m.userId === userId && (!type || m.type === type))
          .sort((a, b) => a.order - b.order);
      },
      
      addCredit: (credit) => {
        set(state => ({
          credits: [...state.credits, { ...credit, id: `cred-${Date.now()}` }]
        }));
      },
      
      requestCreditVerification: (creditId) => {
        console.log(`Verification request sent for credit ${creditId}`);
      },
      
      getCredits: (userId) => {
        return get().credits.filter(c => c.userId === userId);
      },
      
      getStreak: (userId) => {
        const user = get().users.find(u => u.id === userId);
        if (!user || !user.lastPostDates.length) return 0;
        
        const sortedDates = [...user.lastPostDates]
          .map(d => new Date(d))
          .sort((a, b) => b.getTime() - a.getTime());
        
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < sortedDates.length; i++) {
          const date = new Date(sortedDates[i]);
          date.setHours(0, 0, 0, 0);
          
          const expectedDate = new Date(today);
          expectedDate.setDate(today.getDate() - i);
          
          if (date.getTime() === expectedDate.getTime()) {
            streak++;
          } else {
            break;
          }
        }
        
        return Math.min(streak, 7);
      },
      
      addPostDate: (userId, date) => {
        set(state => ({
          users: state.users.map(u =>
            u.id === userId
              ? { ...u, lastPostDates: [...u.lastPostDates, date].slice(-7) }
              : u
          )
        }));
      },
      
      // Story actions
      addStory: (story) => {
        set(state => ({
          stories: [...state.stories, {
            ...story,
            id: `story-${Date.now()}`,
            createdAt: new Date().toISOString()
          }]
        }));
      },
      
      getActiveStories: (userId) => {
        const now = Date.now();
        return get().stories
          .filter(s => s.userId === userId && new Date(s.expiresAt).getTime() > now)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      },
      
      getAllActiveStories: () => {
        const now = Date.now();
        return get().stories
          .filter(s => new Date(s.expiresAt).getTime() > now)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      
      markStoryViewed: (storyId, viewerId) => {
        set(state => ({
          stories: state.stories.map(s =>
            s.id === storyId && !s.viewedBy.includes(viewerId)
              ? { ...s, viewedBy: [...s.viewedBy, viewerId] }
              : s
          )
        }));
      },
      
      cleanupExpiredStories: () => {
        const now = Date.now();
        set(state => ({
          stories: state.stories.filter(s => new Date(s.expiresAt).getTime() > now)
        }));
      },
      
      // Message actions
      getOrCreateThread: (userAId, userBId) => {
        const state = get();
        const existingThread = state.threads.find(t => 
          t.participants.includes(userAId) && t.participants.includes(userBId)
        );
        
        if (existingThread) return existingThread;
        
        const newThread: Thread = {
          id: `thread-${Date.now()}`,
          participants: [userAId, userBId],
          lastMessageAt: new Date().toISOString()
        };
        
        set(state => ({ threads: [...state.threads, newThread] }));
        return newThread;
      },
      
      getThread: (threadId) => {
        return get().threads.find(t => t.id === threadId);
      },
      
      getUserThreads: (userId) => {
        return get().threads
          .filter(t => t.participants.includes(userId))
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      },
      
      sendMessage: (threadId, senderId, content) => {
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          threadId,
          senderId,
          content,
          createdAt: new Date().toISOString()
        };
        
        set(state => ({
          messages: [...state.messages, newMessage],
          threads: state.threads.map(t => 
            t.id === threadId 
              ? { ...t, lastMessageAt: newMessage.createdAt, typingUserId: undefined }
              : t
          )
        }));
      },
      
      getMessages: (threadId) => {
        return get().messages
          .filter(m => m.threadId === threadId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      },
      
      markMessagesRead: (threadId, readerId) => {
        const now = new Date().toISOString();
        set(state => ({
          messages: state.messages.map(m =>
            m.threadId === threadId && m.senderId !== readerId && !m.readAt
              ? { ...m, readAt: now }
              : m
          )
        }));
      },
      
      setTyping: (threadId, userId) => {
        set(state => ({
          threads: state.threads.map(t =>
            t.id === threadId ? { ...t, typingUserId: userId } : t
          )
        }));
      },
    }),
    {
      name: 'inlight-storage',
    }
  )
);
