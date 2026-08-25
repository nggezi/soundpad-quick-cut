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
  onAddClip: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onNudgeIn: (dir: 1 | -1) => void;
  onNudgeOut: (dir: 1 | -1) => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) h.onRedo();
        else h.onUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        h.onRedo();
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
        case "a":
          h.onAddClip();
          break;
        case "i":
          h.onInPoint();
          break;
        case "o":
          h.onOutPoint();
          break;
        case "[":
          e.shiftKey ? h.onNudgeOut(-1) : h.onNudgeIn(-1);
          break;
        case "]":
          e.shiftKey ? h.onNudgeOut(1) : h.onNudgeIn(1);
          break;
        case "home":
          h.onJumpStart();
          break;
        case "end":
          h.onJumpEnd();
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
