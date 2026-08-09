//TODO clean up this file, context menu handling in general.. 


import React, { createContext, useRef, useState, useContext, useMemo } from 'react';
import { ContextMenu } from 'primereact/contextmenu';
import { useTrainerStore } from '../../store/state';
import './ContextMenuProvider.css';

type MenuItem = {
  // Items that supply their own `template` render the whole row themselves and
  // need neither of these.
  label?: string;
  icon?: string; // PrimeReact icon class e.g. "pi pi-trash"
  command?: () => void;
  disabled?: boolean;
  separator?: boolean;
  template?: (item: any) => React.ReactNode;
  className?: string;
};

type ContextMenuContextType = {
  showMenu: (e: React.MouseEvent, items: MenuItem[], path: string, san: string) => void;
  hideMenu: () => void;
  contextSelectedPath: string | null;
};

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const method = useTrainerStore().trainingMethod;

  const cm = useRef<ContextMenu>(null);
  const [model, setModel] = useState<MenuItem[]>([]);
  const [contextSelectedPath, setContextSelectedPath] = useState<string | null>(null);
  const [contextSan, setContextSan] = useState<string>('');

  function showMenu(e: React.MouseEvent, items: MenuItem[], path: string, san: string) {
    if (method !== 'edit') return;
    e.preventDefault();
    setModel(items);
    setContextSelectedPath(path);
    setContextSan(san ?? '');
    cm.current?.show(e);
  }

  // Clear the highlighted path whenever the menu closes — from a menu-item
  // action, an outside click, or Escape. This is wired to <ContextMenu onHide>,
  // which PrimeReact calls from *inside* its own hide(); it must NOT call
  // hide() again or it would recurse into onHide until the stack overflows
  // (which threw before the state ever got reset — leaving the move highlighted
  // after adding a comment).
  function handleHide() {
    setContextSelectedPath(null);
    setContextSan('');
  }

  // Imperative close for menu-item actions. Triggers the ContextMenu's own
  // hide(), which fires onHide -> handleHide to clear the highlight state.
  function hideMenu() {
    (cm.current as any)?.hide();
  }

  const modelWithHeader = useMemo<MenuItem[]>(() => {
    const styledItems = model.map((it) => {
      if (it.separator) return it;
      if (it.template) return it;

      // default row (label + optional prime icon)
      return {
        ...it,
        template: (item: any) => (
          <div className="ctxmenu-item">
            {item.icon ? (
              <span className={`${item.icon} ctxmenu-item-icon`} />
            ) : (
              <span className="ctxmenu-item-spacer" />
            )}
            <span className="ctxmenu-item-label">{item.label}</span>
          </div>
        ),
      };
    });

    return [...styledItems];
  }, [model]);

  return (
    <ContextMenuContext.Provider value={{ showMenu, hideMenu, contextSelectedPath }}>
      <ContextMenu
        model={modelWithHeader}
        ref={cm}
        onHide={handleHide}
        pt={{
          root: { className: 'cr-ctxmenu' },
          menu: { className: 'cr-ctxmenu-list' },
          action: { className: 'cr-ctxmenu-action' },
          label: { className: 'cr-ctxmenu-label' },
          icon: { className: 'cr-ctxmenu-icon' },
          separator: { className: 'cr-ctxmenu-separator' },
        }}
      />
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useAppContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error('useAppContextMenu must be used inside ContextMenuProvider');
  return ctx;
}
