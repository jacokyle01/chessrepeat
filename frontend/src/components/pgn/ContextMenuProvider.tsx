import React, { createContext, useRef, useState, useContext, useMemo } from 'react';
import { ContextMenu } from 'primereact/contextmenu';
import { useTrainerStore } from '../../state/state';

type MenuItem = {
  label: string;
  icon?: string; // PrimeReact icon class e.g. "pi pi-trash"
  command: () => void;
  disabled?: boolean;
  separator?: boolean;
  template?: (item: any) => React.ReactNode;
  className?: string;
};

type ContextMenuContextType = {
  showMenu: (e: React.MouseEvent, items: MenuItem[], path: string, san: string) => void;
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

  function hideMenu() {
    setContextSelectedPath(null);
    setContextSan('');
  }

  const modelWithHeader = useMemo<MenuItem[]>(() => {
    const styledItems = model.map((it) => {
      if (it.separator) return it;
      if (it.template) return it;

      // default row (label + optional prime icon)
      return {
        ...it,
        template: (item: any) => (
          <div className="flex items-center gap-2 px-3 py-2">
            {item.icon ? (
              <span className={`${item.icon} text-gray-500 shrink-0`} />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="text-sm text-gray-900 leading-5 truncate">{item.label}</span>
          </div>
        ),
      };
    });

    return [...styledItems];
  }, [model]);

  return (
    <ContextMenuContext.Provider value={{ showMenu, contextSelectedPath }}>
      <ContextMenu
        model={modelWithHeader}
        ref={cm}
        onHide={hideMenu}
        pt={{
          root: {
            className:
              'min-w-[240px] max-w-[92vw] rounded-xl border border-gray-200 bg-white/95 text-gray-900 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/80',
          },
          menu: { className: 'py-1' },
          action: {
            className:
              'flex w-full items-center rounded-lg outline-none transition ' +
              'hover:bg-gray-100 focus:bg-gray-100 active:bg-gray-200 ' +
              'data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none',
          },
          label: { className: 'select-none' },
          icon: { className: 'text-gray-500' },
          separator: { className: 'my-1 border-t border-gray-200' },
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
