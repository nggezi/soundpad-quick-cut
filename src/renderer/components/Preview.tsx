import { memo } from "react";
import type { RefObject } from "react";
import { IconPause, IconPlay } from "./Icons.js";
import { fmtTime } from "../lib/time.js";

interface Props {
  src: string;
  videoRef: RefObject<HTMLVideoElement>;
  onClick: () => void;
  playing: boolean;
  currentTime: number;
  duration: number;
}

export const Preview = memo(function Preview({
  src,
  videoRef,
  onClick,
  playing,
  currentTime,
  duration,
}: Props) {
  return (
    <div className="preview">
      <video ref={videoRef} src={src} controls={false} onClick={onClick} />
      <button
        className="preview-play"
        onClick={onClick}
        title={playing ? "暂停" : "播放"}
        aria-label={playing ? "暂停" : "播放"}
      >
        {playing ? <IconPause size={26} /> : <IconPlay size={26} />}
      </button>
      <div className="preview-time">
        {fmtTime(currentTime)} <span>/</span> {fmtTime(duration)}
      </div>
    </div>
  );
});
