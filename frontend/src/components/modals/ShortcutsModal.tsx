import React, { useEffect } from 'react';
import { XIcon } from 'lucide-react';
import { comboParts, HOTKEY_GROUPS, useHotkeyStore } from '../../store/hotkeys';
import './modals.css';
import './ShortcutsModal.css';

const Keys: React.FC<{ combo: string | null }> = ({ combo }) =>
  combo ? (
    <span className="shortcut-keys">
      {comboParts(combo).map((part, i) => (
        <kbd key={i}>{part}</kbd>
      ))}
    </span>
  ) : (
    <span className="shortcut-unbound">Not set</span>
  );

const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const bindings = useHotkeyStore((s) => s.bindings);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <dialog open className="shortcuts-dialog" aria-labelledby="shortcuts-title">
      <div className="shortcuts-header">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="shortcuts-icon-btn" aria-label="Close" onClick={onClose}>
          <XIcon size={15} />
        </button>
      </div>

      <div className="shortcuts-grid">
        {HOTKEY_GROUPS.map((group) => (
          <section key={group.label} className="shortcuts-group">
            <h3>{group.label}</h3>
            <ul className="shortcut-list">
              {group.actions.map(({ id, label }) => (
                <li key={id} className="shortcut-row">
                  <span className="shortcut-label">{label}</span>
                  <span className="shortcut-leader" aria-hidden="true" />
                  <Keys combo={bindings[id]} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
};

export default ShortcutsModal;
