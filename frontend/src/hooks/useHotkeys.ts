import { useEffect, useRef } from 'react';
import { comboFromEvent, HotkeyAction, useHotkeyStore } from '../store/hotkeys';

export type HotkeyHandlers = Partial<Record<HotkeyAction, () => void>>;

// Only move navigation makes sense held down; everything else fires once.
const REPEATABLE = new Set<HotkeyAction>(['prevMove', 'nextMove']);

// Anything that takes typed input keeps its keys to itself.
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  // includes range sliders and the like — they don't take text, but they do take arrows
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

// Every dialog in the app is either an open <dialog> or sits in a scrim.
// While one is up, the page behind it shouldn't react to the keyboard.
const OPEN_MODAL = 'dialog[open], .modal-scrim, .simple-modal-scrim';

/**
 * Listens for the user's configured shortcuts on the document and runs the
 * matching handler. `enabled` lets the caller pause it for overlays that
 * aren't dialogs (e.g. the promotion picker).
 */
export function useHotkeys(handlers: HotkeyHandlers, enabled = true) {
  const bindings = useHotkeyStore((s) => s.bindings);

  // Handlers close over render-time state; keep the latest without
  // re-subscribing the listener on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const byCombo = new Map<string, HotkeyAction>();
    for (const [action, combo] of Object.entries(bindings)) {
      if (combo) byCombo.set(combo, action as HotkeyAction);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector(OPEN_MODAL)) return;

      const combo = comboFromEvent(e);
      if (!combo) return;
      const action = byCombo.get(combo);
      if (!action) return;
      if (e.repeat && !REPEATABLE.has(action)) return;

      const handler = handlersRef.current[action];
      if (!handler) return;
      // stops arrows scrolling the page and letters landing anywhere else
      e.preventDefault();
      handler();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bindings, enabled]);
}
