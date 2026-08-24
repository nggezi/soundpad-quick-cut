import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  onClearSelection: () => void;
  onExport: () => void;
  onPlayPause: () => void;
  onInPoint: () => void;
  onOutPoint: () => void;
  onPreview: () => void;
  onStepFrame: (dir: 1 | -1) => void;
  onStepSecond: (dir: 1 | -1) => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const h = ref.current;
      if (e.key === "Escape") {
        h.onClearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        h.onExport();
        return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          h.onPlayPause();
          break;
        case "i":
          h.onInPoint();
          break;
        case "o":
          h.onOutPoint();
          break;
        case "arrowleft":
          e.shiftKey ? h.onStepSecond(-1) : h.onStepFrame(-1);
          break;
        case "arrowright":
          e.shiftKey ? h.onStepSecond(1) : h.onStepFrame(1);
          break;
        case "p":
          h.onPreview();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
