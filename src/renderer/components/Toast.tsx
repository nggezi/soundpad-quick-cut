import type { ToastData } from "../hooks/useToast.js";
import { IconAlert, IconCheck } from "./Icons.js";

export function Toast({ toast }: { toast: ToastData }) {
  return (
    <div className={"toast " + toast.kind}>
      <span className="toast-icon">
        {toast.kind === "success" ? <IconCheck size={15} /> : <IconAlert size={15} />}
      </span>
      <span className="toast-msg">{toast.msg}</span>
    </div>
  );
}
