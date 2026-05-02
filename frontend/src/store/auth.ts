import { create } from "zustand";

const API_URL = import.meta.env.VITE_API_URL;

// PLAYGROUND_KEY is the training-card key used for not-signed-in users,
// who exist only locally in IndexedDB. Authenticated users key by
// username so the Google sub never has to ride on the wire.
export const PLAYGROUND_KEY = "__playground__";

export type AuthUser = {
  username: string;
  picture?: string;
};

type AuthState = {
  user: AuthUser | null;
  // Whether the login overlay is open. Replaces the old /login route.
  showLogin: boolean;

  isAuthenticated: () => boolean;

  setUser: (user: AuthUser | null) => void;
  openLogin: () => void;
  closeLogin: () => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  showLogin: false,

  isAuthenticated: () => !!get().user,

  setUser: (user) => set({ user }),

  openLogin: () => set({ showLogin: true }),
  closeLogin: () => set({ showLogin: false }),

  clearAuth: () => {
    // hit the backend to delete the session and expire the cookie
    fetch(`${API_URL}/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch((err) => console.warn('logout request failed', err));

    set({ user: null });
    // @ts-ignore
    window.google?.accounts?.id?.disableAutoSelect?.();
  },
}));
