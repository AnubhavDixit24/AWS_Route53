import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface ShortcutsContextValue {
  registerCreateAction: (fn: (() => void) | null) => void;
  registerSearchFocus: (fn: (() => void) | null) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | undefined>(undefined);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const createActionRef = useRef<(() => void) | null>(null);
  const searchFocusRef = useRef<(() => void) | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const registerCreateAction = (fn: (() => void) | null) => {
    createActionRef.current = fn;
  };
  const registerSearchFocus = (fn: (() => void) | null) => {
    searchFocusRef.current = fn;
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Esc should work even while typing (to close modals)
      if (e.key === "Escape") {
        const closeButtons = document.querySelectorAll<HTMLButtonElement>(".modal-close");
        if (closeButtons.length > 0) {
          closeButtons[closeButtons.length - 1].click();
        }
        return;
      }

      if (isTyping) return;

      if (e.key === "/") {
        e.preventDefault();
        searchFocusRef.current?.();
      } else if (e.key === "n") {
        createActionRef.current?.();
      } else if (e.key === "?") {
        setShowHelp((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ShortcutsContext.Provider value={{ registerCreateAction, registerSearchFocus }}>
      {children}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-box" style={{ width: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Keyboard shortcuts</h2>
              <button className="modal-close" onClick={() => setShowHelp(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="shortcut-row">
                <kbd>/</kbd> <span>Focus search</span>
              </div>
              <div className="shortcut-row">
                <kbd>n</kbd> <span>Create new</span>
              </div>
              <div className="shortcut-row">
                <kbd>Esc</kbd> <span>Close dialog</span>
              </div>
              <div className="shortcut-row">
                <kbd>?</kbd> <span>Toggle this help</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) throw new Error("useShortcuts must be used within ShortcutsProvider");
  return ctx;
}