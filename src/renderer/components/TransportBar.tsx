import { memo } from "react";
import { IconFrameBack, IconFrameForward, IconPause, IconPlay, IconSecBack, IconSecForward } from "./Icons.js";

interface Props {
  playing: boolean;
  onPlayPause: () => void;
  onStepFrame: (dir: 1 | -1) => void;
  onStepSecond: (dir: 1 | -1) => void;
  onHoldStart: (fn: () => void) => void;
  onHoldEnd: () => void;
}

export const TransportBar = memo(function TransportBar({
  playing,
  onPlayPause,
  onStepFrame,
  onStepSecond,
  onHoldStart,
  onHoldEnd,
}: Props) {
  return (
    <div className="transport-bar">
      <div className="transport-group">
        <button
          className="transport-btn"
          onMouseDown={() => onHoldStart(() => onStepFrame(-1))}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          title="上一帧（←）"
        >
          <IconFrameBack size={15} />
          <span>帧</span>
        </button>
        <button
          className="transport-btn"
          onMouseDown={() => onHoldStart(() => onStepSecond(-1))}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          title="上一秒（Shift+←）"
        >
          <IconSecBack size={15} />
          <span>秒</span>
        </button>
      </div>
      <button className="primary play-btn" onClick={onPlayPause}>
        {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        <span>{playing ? "暂停" : "播放"}</span>
      </button>
      <div className="transport-group">
        <button
          className="transport-btn"
          onMouseDown={() => onHoldStart(() => onStepSecond(1))}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          title="下一秒（Shift+→）"
        >
          <IconSecForward size={15} />
          <span>秒</span>
        </button>
        <button
          className="transport-btn"
          onMouseDown={() => onHoldStart(() => onStepFrame(1))}
          onMouseUp={onHoldEnd}
          onMouseLeave={onHoldEnd}
          title="下一帧（→）"
        >
          <IconFrameForward size={15} />
          <span>帧</span>
        </button>
      </div>
    </div>
  );
});
