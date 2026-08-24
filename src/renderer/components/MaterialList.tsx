import { memo } from "react";
import type { SavedMaterial } from "../hooks/useMaterials.js";
import { fileName } from "../lib/file.js";
import { fmtTime } from "../lib/time.js";
import { IconTrash, IconVideo } from "./Icons.js";

interface Props {
  materials: SavedMaterial[];
  activeIdx: number | null;
  onSelect: (idx: number) => void;
  onRemove: (idx: number) => void;
}

export const MaterialList = memo(function MaterialList({
  materials,
  activeIdx,
  onSelect,
  onRemove,
}: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">素材库</div>
      <div className="sidebar-list">
        {materials.map((m, i) => (
          <div
            key={m.path}
            className={"sidebar-item" + (i === activeIdx ? " active" : "")}
            onClick={() => onSelect(i)}
          >
            <span className="sidebar-item-icon">
              <IconVideo size={15} />
            </span>
            <span className="sidebar-item-name" title={m.path}>{fileName(m.path)}</span>
            <span className="sidebar-item-time">{m.duration > 0 ? fmtTime(m.duration) : "···"}</span>
            <button
              className="icon-btn sidebar-item-del"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              title="移除素材"
            >
              <IconTrash size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
