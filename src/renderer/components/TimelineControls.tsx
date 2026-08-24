import { memo } from "react";
import {
  IconEar,
  IconInPoint,
  IconOutPoint,
  IconReset,
  IconScissors,
  IconZoomIn,
  IconZoomOut,
} from "./Icons.js";

interface Props {
  inPoint: number | null;
  outPoint: number | null;
  zoom: number;
  onIn: () => void;
  onOut: () => void;
  onPreview: () => void;
  onClear: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
}

export const TimelineControls = memo(function TimelineControls({
  inPoint,
  outPoint,
  zoom,
  onIn,
  onOut,
  onPreview,
  onClear,
  onZoomOut,
  onZoomIn,
  onZoomReset,
}: Props) {
  return (
    <div className="controls">
      <div className="controls-left">
        <div className="io-group">
          <button className="io-btn in" onClick={onIn}>
            <IconInPoint size={15} />
            入点
            <span className="kbd">I</span>
          </button>
          <button className="io-btn out" onClick={onOut}>
            <IconOutPoint size={15} />
            出点
            <span className="kbd">O</span>
          </button>
        </div>
        <button onClick={onPreview} disabled={inPoint === null || outPoint === null}>
          <IconEar size={15} />
          预听
          <span className="kbd">P</span>
        </button>
        <button onClick={onClear} disabled={inPoint === null && outPoint === null}>
          <IconScissors size={15} />
          清除选区
        </button>
      </div>
      <div className="controls-right">
        <button className="icon-btn" onClick={onZoomOut} disabled={zoom <= 1} title="缩小">
          <IconZoomOut size={15} />
        </button>
        <span className="zoom-label">{zoom.toFixed(1)}x</span>
        <button className="icon-btn" onClick={onZoomIn} disabled={zoom >= 40} title="放大">
          <IconZoomIn size={15} />
        </button>
        <button className="icon-btn" onClick={onZoomReset} disabled={zoom === 1} title="重置缩放">
          <IconReset size={15} />
        </button>
        <span className="kbd">Ctrl+滚轮</span>
      </div>
    </div>
  );
});
