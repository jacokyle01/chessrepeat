import { create } from "zustand";

export type AuthUser = {
  sub: string;       // Google stable user id
  name?: string;
  email?: string;
  picture?: string;
};

type AuthState = {
  idToken: string | null;
  user: AuthUser | null;

  isAuthenticated: () => boolean;

  setAuthFromIdToken: (idToken: string) => void;
  clearAuth: () => void;

  hydrateFromStorage: () => void;
};

const TOKEN_KEY = "chessrepeat_id_token";

function decodeJwtPayload(token: string): any | null {
  try {
    const payloadB64 = token.split(".")[1];
    // base64url -> base64
    const b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  idToken: null,
  user: null,

  isAuthenticated: () => !!get().idToken && !!get().user,

  setAuthFromIdToken: (idToken: string) => {
    const payload = decodeJwtPayload(idToken);
    if (!payload?.sub) {
      // token malformed
      set({ idToken: null, user: null });
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    const user: AuthUser = {
      sub: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };

    localStorage.setItem(TOKEN_KEY, idToken);
    set({ idToken, user });
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ idToken: null, user: null });
    // Optional: prevent auto-select
    // @ts-ignore
    window.google?.accounts?.id?.disableAutoSelect?.();
  },

  hydrateFromStorage: () => {
    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) return;
    get().setAuthFromIdToken(tok);
  },
}));
