// import { createContext, useRef, useState, useContext } from 'react';
// import { ContextMenu } from 'primereact/contextmenu';
// import { useTrainerStore } from '../../state/state';

// type MenuItem = {
//   label: string;
//   icon?: string;
//   command: () => void;
// };

// type ContextMenuContextType = {
//   showMenu: (e: React.MouseEvent, items: MenuItem[], path: string) => void;
//   contextSelectedPath: string | null;
// };

// const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

// export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
//   const method = useTrainerStore().trainingMethod;
//   const cm = useRef<ContextMenu>(null);
//   const [model, setModel] = useState<MenuItem[]>([]);
//   const [contextSelectedPath, setContextSelectedPath] = useState<string | null>(null);

//   // const nodeName = node?.data?.san ?? node?.san ?? node?.id ?? 'Move';

//   // const modelWithHeader = [
//   //   {
//   //     label: nodeName,
//   //     disabled: true,
//   //     className: 'px-3 py-2 font-semibold text-gray-800 cursor-default',
//   //     template: (item: any) => (
//   //       <div className="px-3 py-2 font-semibold text-gray-800 select-none">{item.label}</div>
//   //     ),
//   //   },
//   //   { separator: true },
//   //   ...model,
//   // ];

//   function showMenu(e: React.MouseEvent, items: MenuItem[], path: string, san: string) {
//     if (method != 'edit') return;
//     e.preventDefault();
//     setModel(items);
//     setContextSelectedPath(path);
//     cm.current?.show(e);
//   }

//   function hideMenu() {
//     setContextSelectedPath(null);
//   }

//   return (
//     <ContextMenuContext.Provider value={{ showMenu, contextSelectedPath }}>
//       <ContextMenu
//         model={model}
//         ref={cm}
//         onHide={hideMenu}
//         pt={{
//           root: { className: 'bg-white text-black shadow-lg rounded-md' },
//           menuitem: { className: 'hover:bg-gray-100 cursor-pointer' },
//         }}
//       />
//       {children}
//     </ContextMenuContext.Provider>
//   );
// }

// export function useAppContextMenu() {
//   const ctx = useContext(ContextMenuContext);
//   if (!ctx) throw new Error('useAppContextMenu must be used inside ContextMenuProvider');
//   return ctx;
// }

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
  const [contextSan, setContextSan] = useState<string>(''); // header display

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
    const headerLabel = contextSan?.trim() ? contextSan : 'Move';

    const sep: MenuItem = { separator: true, label: '', command: () => {} };

    // Render “real” items with a consistent modern layout
    const styledItems = model.map((it) => {
      // keep separators as-is
      if (it.separator) return it;

      // if caller provided a custom template, DO NOT override it
      if (it.template) return it;

      // otherwise apply your default row template
      return {
        ...it,
        template: (item: any) => (
          <div className="flex items-center gap-2 py-2">
            {item.icon ? <span className={`${item.icon} text-gray-500`} /> : <span className="w-4" />}
            <span className="text-sm text-gray-900">{item.label}</span>
          </div>
        ),
      };
    });

    return [...styledItems];
  }, [model, contextSan]);

  return (
    <ContextMenuContext.Provider value={{ showMenu, contextSelectedPath }}>
      <ContextMenu
        model={modelWithHeader}
        ref={cm}
        onHide={hideMenu}
        pt={{
          // Outer popup
          root: {
            className:
              'min-w-[220px] rounded-xl border border-gray-200 bg-white/95 text-gray-900 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/80',
          },

          // The list container
          menu: { className: 'py-1' },

          // Each li
          // menuitem: { className: 'px-1' },

          // Clickable area
          action: {
            className:
              'flex w-full items-center rounded-lg outline-none transition ' +
              'hover:bg-gray-100 focus:bg-gray-100 active:bg-gray-200 ' +
              'data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none',
          },

          // Label / icon hooks (may vary by version)
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
