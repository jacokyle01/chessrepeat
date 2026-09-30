import { create } from 'zustand';

export type HotkeyAction =
  | 'firstMove'
  | 'prevMove'
  | 'nextMove'
  | 'lastMove'
  | 'modeEdit'
  | 'modeLearn'
  | 'modeRecall'
  | 'toggleComments'
  | 'copyFen'
  | 'openSettings'
  | 'openShortcuts';

// A binding is a normalized combo string (see comboFromEvent), or null when
// the action is deliberately left unbound.
export type Bindings = Record<HotkeyAction, string | null>;

// Listed in the order the shortcuts modal shows them.
export const HOTKEY_GROUPS: { label: string; actions: { id: HotkeyAction; label: string }[] }[] = [
  {
    label: 'Moves',
    actions: [
      { id: 'prevMove', label: 'Previous move' },
      { id: 'nextMove', label: 'Next move' },
      { id: 'firstMove', label: 'First move' },
      { id: 'lastMove', label: 'Last move' },
    ],
  },
  {
    label: 'Mode',
    actions: [
      { id: 'modeEdit', label: 'Edit' },
      { id: 'modeLearn', label: 'Learn' },
      { id: 'modeRecall', label: 'Recall' },
    ],
  },
  {
    label: 'Chapter',
    actions: [
      { id: 'toggleComments', label: 'Show / hide comments' },
      { id: 'copyFen', label: 'Copy FEN' },
    ],
  },
  {
    label: 'App',
    actions: [
      { id: 'openSettings', label: 'Training settings' },
      { id: 'openShortcuts', label: 'Keyboard shortcuts' },
    ],
  },
];

export const DEFAULT_BINDINGS: Bindings = {
  firstMove: 'ArrowUp',
  prevMove: 'ArrowLeft',
  nextMove: 'ArrowRight',
  lastMove: 'ArrowDown',
  modeEdit: 'e',
  modeLearn: 'l',
  modeRecall: 'r',
  toggleComments: 'c',
  copyFen: 'f',
  openSettings: 's',
  openShortcuts: '?',
};

export const HOTKEYS_KEY = 'chessrepeat:hotkeys';

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'OS']);

// Turns a keydown into the string bindings are stored as, e.g. "ctrl+k",
// "shift+ArrowLeft", "?". Returns null for a bare modifier press.
//
// Shift is only spelled out where e.key doesn't already carry it: "?" is
// shift+/ on most layouts, but binding it as "shift+?" would stop matching on
// layouts where it isn't. Letters are the exception — e.key gives "E" for
// shift+e, which is lowercased and marked explicitly so the two read apart.
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  let key = e.key === ' ' ? 'Space' : e.key;
  const isChar = key.length === 1;
  const isLetter = isChar && key.toLowerCase() !== key.toUpperCase();
  if (isLetter) key = key.toLowerCase();

  const mods: string[] = [];
  if (e.ctrlKey) mods.push('ctrl');
  if (e.altKey) mods.push('alt');
  if (e.metaKey) mods.push('meta');
  if (e.shiftKey && (!isChar || isLetter)) mods.push('shift');
  return [...mods, key].join('+');
}

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ctrl: 'Ctrl',
  alt: 'Alt',
  meta: 'Meta',
  shift: 'Shift',
  Escape: 'Esc',
};

// The combo split into the parts a <kbd> row shows, e.g. ["Ctrl", "K"].
export function comboParts(combo: string): string[] {
  // "+" can itself be the key ("ctrl++"), so split off modifiers from the left
  const parts: string[] = [];
  let rest = combo;
  for (const mod of ['ctrl', 'alt', 'meta', 'shift']) {
    if (rest.startsWith(mod + '+') && rest.length > mod.length + 1) {
      parts.push(mod);
      rest = rest.slice(mod.length + 1);
    }
  }
  parts.push(rest);
  return parts.map((p) => KEY_LABELS[p] ?? (p.length === 1 ? p.toUpperCase() : p));
}

function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(HOTKEYS_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const stored = JSON.parse(raw) as Partial<Bindings>;
    // Merge over the defaults so an action added after the user last saved
    // still gets its key, and one removed since is dropped.
    const merged = { ...DEFAULT_BINDINGS };
    for (const id of Object.keys(DEFAULT_BINDINGS) as HotkeyAction[]) {
      if (id in stored) merged[id] = stored[id] ?? null;
    }
    return merged;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

function saveBindings(bindings: Bindings) {
  try {
    localStorage.setItem(HOTKEYS_KEY, JSON.stringify(bindings));
  } catch {
    // storage blocked — the bindings still apply for this tab
  }
}

type HotkeyState = {
  bindings: Bindings;
  // Binds combo to action. Any other action holding the same combo is
  // unbound and returned, so the caller can say what was displaced.
  setBinding: (action: HotkeyAction, combo: string | null) => HotkeyAction | null;
  resetBindings: () => void;
};

export const useHotkeyStore = create<HotkeyState>((set, get) => ({
  bindings: loadBindings(),

  setBinding: (action, combo) => {
    const bindings = { ...get().bindings };
    let displaced: HotkeyAction | null = null;
    if (combo) {
      for (const id of Object.keys(bindings) as HotkeyAction[]) {
        if (id !== action && bindings[id] === combo) {
          bindings[id] = null;
          displaced = id;
        }
      }
    }
    bindings[action] = combo;
    saveBindings(bindings);
    set({ bindings });
    return displaced;
  },

  resetBindings: () => {
    const bindings = { ...DEFAULT_BINDINGS };
    saveBindings(bindings);
    set({ bindings });
  },
}));
