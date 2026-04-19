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
  // Whether the login overlay is open. Replaces the old /login route.
  showLogin: boolean;

  isAuthenticated: () => boolean;
  isPlayground: () => boolean;

  setUser: (user: AuthUser | null) => void;
  openLogin: () => void;
  closeLogin: () => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  repertoireOwner: null,
  showLogin: false,

  isAuthenticated: () => !!get().user,
  isPlayground: () => !get().user,

  setUser: (user) => set({ user }),


  openLogin: () => set({ showLogin: true }),
  closeLogin: () => set({ showLogin: false }),

  clearAuth: () => {
    // hit the backend to delete the session and expire the cookie
    fetch('http://localhost:8080/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch((err) => console.warn('logout request failed', err));

    set({ user: null });
    // @ts-ignore
    window.google?.accounts?.id?.disableAutoSelect?.();
  },
}));
