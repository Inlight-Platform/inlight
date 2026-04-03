import { create } from 'zustand';

interface MinimizedChatState {
  isMinimized: boolean;
  originRoute: string | null;
  chatRoute: string | null;
  minimize: (originRoute: string, chatRoute: string) => void;
  expand: () => void;
  close: () => void;
}

export const useMinimizedChat = create<MinimizedChatState>((set) => ({
  isMinimized: false,
  originRoute: null,
  chatRoute: null,
  minimize: (originRoute, chatRoute) => set({ isMinimized: true, originRoute, chatRoute }),
  expand: () => set({ isMinimized: false, originRoute: null, chatRoute: null }),
  close: () => set({ isMinimized: false, originRoute: null, chatRoute: null }),
}));
