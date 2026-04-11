import { create } from "zustand";

export type AuthUser = {
  sub: string;       // Google stable user id
  name?: string;
  email?: string;
  picture?: string;
};

type AuthState = {
  user: AuthUser | null;
  repertoireId: string | null;

  isAuthenticated: () => boolean;

  setUser: (user: AuthUser | null) => void;
  setRepertoireId: (id: string) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  repertoireId: null,

  isAuthenticated: () => !!get().user,

  setUser: (user) => set({ user }),

  setRepertoireId: (id: string) => set({ repertoireId: id }),

  clearAuth: () => {
    set({ user: null, repertoireId: null });
    // Optional: prevent auto-select
    // @ts-ignore
    window.google?.accounts?.id?.disableAutoSelect?.();
  },
}));
