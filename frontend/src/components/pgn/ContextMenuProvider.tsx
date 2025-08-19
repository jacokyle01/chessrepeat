import { createContext, useRef, useState, useContext } from "react";
import { ContextMenu } from "primereact/contextmenu";

type MenuItem = {
  label: string;
  icon?: string;
  command: () => void;
};

type ContextMenuContextType = {
  showMenu: (e: React.MouseEvent, items: MenuItem[], path: string) => void;
  contextSelectedPath: string | null;
};

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const cm = useRef<ContextMenu>(null);
  const [model, setModel] = useState<MenuItem[]>([]);
  const [contextSelectedPath, setContextSelectedPath] = useState<string | null>(null);

  function showMenu(e: React.MouseEvent, items: MenuItem[], path: string) {
    e.preventDefault();
    setModel(items);
    setContextSelectedPath(path);
    cm.current?.show(e);
  }

  function hideMenu() {
    setContextSelectedPath(null);
  }

  return (
    <ContextMenuContext.Provider value={{ showMenu, contextSelectedPath }}>
      <ContextMenu
        model={model}
        ref={cm}
        onHide={hideMenu}
        pt={{
          root: { className: "bg-white text-black shadow-lg rounded-md" },
          menuitem: { className: "hover:bg-gray-100 cursor-pointer" },
        }}
      />
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useAppContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error("useAppContextMenu must be used inside ContextMenuProvider");
  return ctx;
}
