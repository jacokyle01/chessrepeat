import { create } from "zustand";

export const PLAYGROUND_SUB = "__playground__";

export type AuthUser = {
  sub: string;       // Google stable user id
  username?: string;
  email?: string;
  picture?: string;
};

type AuthState = {
  user: AuthUser | null;
  repertoireId: string | null;

  isAuthenticated: () => boolean;
  isPlayground: () => boolean;

  setUser: (user: AuthUser | null) => void;
  setRepertoireId: (id: string) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  repertoireId: null,

  isAuthenticated: () => !!get().user,
  isPlayground: () => !get().user,

  setUser: (user) => set({ user }),

  setRepertoireId: (id: string) => set({ repertoireId: id }),

  clearAuth: () => {
    // hit the backend to delete the session and expire the cookie
    fetch('http://localhost:8080/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch((err) => console.warn('logout request failed', err));

    set({ user: null, repertoireId: null });
    // @ts-ignore
    window.google?.accounts?.id?.disableAutoSelect?.();
  },
}));
