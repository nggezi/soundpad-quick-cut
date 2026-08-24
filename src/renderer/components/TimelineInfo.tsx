import { memo } from "react";
import type { ProbeResult } from "../../shared/types.js";
import { fmtTime } from "../lib/time.js";

interface Props {
  currentTime: number;
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  probe: ProbeResult | null;
}

export const TimelineInfo = memo(function TimelineInfo({
  currentTime,
  inPoint,
  outPoint,
  duration,
  probe,
}: Props) {
  const selDur = inPoint !== null && outPoint !== null ? outPoint - inPoint : 0;
  return (
    <div className="timeline-info">
      <span className="tc-item">入点 <span className="in">{inPoint !== null ? fmtTime(inPoint) : "--:--.--"}</span></span>
      <span className="tc-item">当前 <span className="value">{fmtTime(currentTime)}</span></span>
      <span className="tc-item">出点 <span className="out">{outPoint !== null ? fmtTime(outPoint) : "--:--.--"}</span></span>
      <span className="tc-item">时长 <span className="value">{fmtTime(duration)}</span></span>
      <span className="tc-item">选段 <span className="value">{selDur > 0 ? fmtTime(selDur) : "--:--.--"}</span></span>
      {probe && <span className="tc-item">音频 <span className="value">{probe.audioCodec} {probe.audioSampleRate}Hz {probe.audioChannels}ch</span></span>}
    </div>
  );
});
