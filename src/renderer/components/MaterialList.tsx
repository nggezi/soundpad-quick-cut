import { memo } from "react";
import type { SavedMaterial } from "../hooks/useMaterials.js";
import { fileName } from "../lib/file.js";
import { fmtTime } from "../lib/time.js";
import { IconTrash, IconVideo, IconX } from "./Icons.js";

interface Props {
  materials: SavedMaterial[];
  activeIdx: number | null;
  onSelect: (idx: number) => void;
  onRemove: (idx: number) => void;
  onSelectClip: (idx: number, clipId: string) => void;
  onRemoveClip: (idx: number, clipId: string) => void;
}

export const MaterialList = memo(function MaterialList({
  materials,
  activeIdx,
  onSelect,
  onRemove,
  onSelectClip,
  onRemoveClip,
}: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">素材库</div>
      <div className="sidebar-list">
        {materials.map((m, i) => (
          <div key={m.path} className="sidebar-material">
            <div
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
            {m.clips.length > 0 && (
              <div className="clip-list">
                {m.clips.map((c, ci) => {
                  const isActiveClip =
                    i === activeIdx && m.inPoint === c.inPoint && m.outPoint === c.outPoint;
                  return (
                    <div
                      key={c.id}
                      className={"clip-item" + (isActiveClip ? " active" : "")}
                      onClick={() => onSelectClip(i, c.id)}
                    >
                      <span className="clip-idx">{String(ci + 1).padStart(2, "0")}</span>
                      <span className="clip-range">{fmtTime(c.inPoint)} – {fmtTime(c.outPoint)}</span>
                      <span className="clip-dur">{fmtTime(c.outPoint - c.inPoint)}</span>
                      <button
                        className="icon-btn clip-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveClip(i, c.id);
                        }}
                        title="移除片段"
                      >
                        <IconX size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
