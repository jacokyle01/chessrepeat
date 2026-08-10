import { create } from 'zustand';

export type Theme = 'light' | 'dark';

// Kept in sync with the inline bootstrap in index.html, which reads the same
// key and stamps the same attribute before React ever mounts. Both halves have
// to agree or the page paints one theme and then swaps to the other.
export const THEME_KEY = 'chessrepeat:theme';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The stored choice, or the OS preference when there isn't one. Reading from
// <html> rather than from storage: the bootstrap script already resolved this
// exact question before first paint, so this can't disagree with what's on
// screen even if storage is unreadable (Safari private mode throws).
function initialTheme(): Theme {
  const stamped = document.documentElement.dataset.theme;
  return stamped === 'dark' || stamped === 'light' ? stamped : systemTheme();
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked — the theme still applies, it just won't outlive the tab
  }
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme(),

  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },

  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
