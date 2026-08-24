import { memo } from "react";
import {
  IconFrameBack,
  IconFrameForward,
  IconPause,
  IconPlay,
  IconRepeat,
  IconSecBack,
  IconSecForward,
  IconVolume,
  IconVolumeMute,
} from "./Icons.js";

interface Props {
  playing: boolean;
  onPlayPause: () => void;
  onStepFrame: (dir: 1 | -1) => void;
  onStepSecond: (dir: 1 | -1) => void;
  onHoldStart: (fn: () => void) => void;
  onHoldEnd: () => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export const TransportBar = memo(function TransportBar({
  playing,
  onPlayPause,
  onStepFrame,
  onStepSecond,
  onHoldStart,
  onHoldEnd,
  loop,
  onLoopChange,
  volume,
  onVolumeChange,
}: Props) {
  return (
    <div className="transport-bar">
      <div className="transport-extra">
        <button
          className={"transport-btn loop-btn" + (loop ? " active" : "")}
          onClick={() => onLoopChange(!loop)}
          title="循环播放选区"
        >
          <IconRepeat size={15} />
          <span>循环</span>
        </button>
      </div>
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
      <div className="transport-extra transport-volume">
        {volume <= 0.02 ? <IconVolumeMute size={15} /> : <IconVolume size={15} />}
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          title="音量"
          aria-label="音量"
        />
        <span className="volume-value">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
});
