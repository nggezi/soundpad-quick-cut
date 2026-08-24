import { memo } from "react";
import { IconFile, IconPlus, IconVideo, IconWave } from "./Icons.js";

interface Props {
  fileName: string | null;
  materialCount: number;
  onOpen: () => void;
}

export const TopBar = memo(function TopBar({ fileName, materialCount, onOpen }: Props) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <IconWave size={17} />
        </div>
        <div className="brand-text">
          <span className="brand-title">Soundpad Quick Cut</span>
          <span className="brand-sub">视频音效快剪</span>
        </div>
      </div>
      <div className="topbar-actions">
        {materialCount > 0 && (
          <span className="mat-count">
            <IconVideo size={13} />
            {materialCount} 个素材
          </span>
        )}
        {fileName && (
          <span className="filename" title={fileName}>
            <IconFile size={12} />
            {fileName}
          </span>
        )}
        <button onClick={onOpen} className="primary">
          <IconPlus size={15} />
          导入视频
        </button>
      </div>
    </div>
  );
});
