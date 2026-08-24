import { useCallback, useEffect, useState } from "react";

export interface ToastData {
  msg: string;
  kind: "success" | "error";
}

export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(t);
  }, [toast, durationMs]);

  const showToast = useCallback(
    (msg: string, kind: ToastData["kind"] = "success") => setToast({ msg, kind }),
    [],
  );

  return { toast, showToast };
}
