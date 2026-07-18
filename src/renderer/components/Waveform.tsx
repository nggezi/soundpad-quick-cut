import React, { useCallback, useEffect, useRef, useState } from "react";
import type { WaveformPoint } from "../../shared/types.js";

interface Props {
  points: WaveformPoint[];
  duration: number;
  playhead: number;
  inPoint: number | null;
  outPoint: number | null;
  loading: boolean;
  zoom: number;
  playing: boolean;
  onSeek: (t: number) => void;
  onRegionChange: (start: number, end: number) => void;
  onZoomChange: (zoom: number) => void;
}

const HANDLE_HIT = 14;
const DRAG_THRESHOLD = 0.1;
const ZOOM_MIN = 1;
const ZOOM_MAX = 40;
const ZOOM_STEP = 1.15;

export const Waveform: React.FC<Props> = ({
  points, duration, playhead, inPoint, outPoint, loading, zoom, playing,
  onSeek, onRegionChange, onZoomChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // ---- Stable refs ----
  const dur = useRef(duration); dur.current = duration;
  const ipt = useRef(inPoint);  ipt.current = inPoint;
  const opt = useRef(outPoint); opt.current = outPoint;
  const ph  = useRef(playhead); ph.current = playhead;
  const zm  = useRef(zoom);     zm.current = zoom;
  const pts = useRef(points);   pts.current = points;

  // ---- View panning (via native scrollbar) ----
  const [viewStart, setViewStart] = useState(0);
  const cropRef = useRef(false);

  const visWindow = duration / zoom;
  const clampedVS = Math.max(0, Math.min(viewStart, Math.max(0, duration - visWindow)));
  const visEnd = clampedVS + visWindow;

  const vsRef = useRef(clampedVS); vsRef.current = clampedVS;
  const vwRef = useRef(visWindow); vwRef.current = visWindow;
  const durRef = useRef(duration); durRef.current = duration;

  // ---- Sync viewStart → scrollbar position ----
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (cropRef.current) { cropRef.current = false; return; }
    if (zoom <= 1) return;
    const totalW = scroller.scrollWidth - scroller.clientWidth;
    const scrollTarget = totalW * (clampedVS / (duration - visWindow));
    if (Math.abs(scroller.scrollLeft - scrollTarget) > 1) {
      scroller.scrollLeft = scrollTarget;
    }
  }, [clampedVS, visWindow, zoom, duration]);

  // ---- Sync scrollbar → viewStart ----
  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || zoom <= 1) return;
    const totalW = scroller.scrollWidth - scroller.clientWidth;
    if (totalW <= 0) return;
    const ratio = scroller.scrollLeft / totalW;
    setViewStart(ratio * (duration - visWindow));
    cropRef.current = true;
  }, [duration, visWindow, zoom]);

  // ---- Auto-pan: only during playback, keep playhead visible ----
  useEffect(() => {
    if (!playing) return; // pause = user controls view freely
    if (duration <= 0 || visWindow <= 0) return;
    if (playhead < clampedVS) { setViewStart(playhead); }
    else if (playhead > visEnd) { setViewStart(playhead - visWindow); }
  }, [playing, playhead, clampedVS, visEnd, visWindow, duration]);

  // Re-clamp on zoom change
  useEffect(() => {
    setViewStart((prev) => {
      const vw = duration / zoom;
      return Math.max(0, Math.min(prev, Math.max(0, duration - vw)));
    });
  }, [zoom, duration]);

  // ---- Drag state ----
  const mode = useRef<"idle" | "maybeDrag" | "dragging">("idle");
  const dragStartX = useRef(0);
  const dragStartT = useRef(0);
  const dragWhich = useRef<"in" | "out" | null>(null);

  // ---- Draw main waveform ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#080b12";
    ctx.fillRect(0, 0, w, h);

    const p = pts.current, d = durRef.current;
    if (loading) {
      ctx.fillStyle = "#7c3aed"; ctx.font = "13px sans-serif";
      ctx.textAlign = "center"; ctx.fillText("正在提取音频波形...", w / 2, h / 2);
      return;
    }
    if (p.length === 0 || d === 0) {
      ctx.fillStyle = "#4a5670"; ctx.font = "12px sans-serif";
      ctx.textAlign = "center"; ctx.fillText("无音频波形", w / 2, h / 2);
      return;
    }

    const vs = vsRef.current, vw = vwRef.current;
    if (vw <= 0) return;
    const ve = vs + vw, pl = p.length, mid = h / 2;
    const bw = Math.max(1, w / pl - 0.5);
    for (let i = 0; i < pl; i++) {
      const pt = p[i];
      if (pt.t < vs || pt.t > ve) continue;
      const amp = Math.max(0.02, Math.abs(pt.max - pt.min));
      if (amp < 0.1) ctx.fillStyle = "#6366f1";
      else if (amp < 0.4) ctx.fillStyle = "#22d3ee";
      else ctx.fillStyle = "#facc15";
      ctx.fillRect(((pt.t - vs) / vw) * w, mid - amp * (h * 0.45), bw, amp * (h * 0.45) * 2);
    }
    ctx.fillStyle = "#4a5670"; ctx.font = "10px monospace"; ctx.textAlign = "center";
    const ti = vw > 30 ? 5 : vw > 10 ? 2 : vw > 5 ? 1 : 0.5;
    for (let t = Math.ceil(vs / ti) * ti; t <= ve; t += ti) {
      const x = ((t - vs) / vw) * w;
      ctx.fillRect(x - 0.5, h - 14, 1, 8);
      ctx.fillText(`${Math.floor(t / 60)}:${((t % 60).toFixed(ti < 1 ? 1 : 0)).padStart(ti < 1 ? 4 : 2, "0")}`, x, h - 2);
    }
  }, [loading]);

  // ---- Draw overview ----
  const drawOverview = useCallback(() => {
    const canvas = overviewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0e1220"; ctx.fillRect(0, 0, w, h);
    const p = pts.current, d = durRef.current;
    if (p.length === 0 || d === 0) return;
    const pl = p.length, mid = h / 2;
    for (let i = 0; i < pl; i++) {
      const pt = p[i];
      const amp = Math.max(0.02, Math.abs(pt.max - pt.min));
      if (amp < 0.1) ctx.fillStyle = "#6366f1";
      else if (amp < 0.4) ctx.fillStyle = "#22d3ee";
      else ctx.fillStyle = "#facc15";
      ctx.fillRect((pt.t / d) * w, mid - amp * (h * 0.4), Math.max(0.5, w / pl - 0.5), amp * (h * 0.8));
    }
    const ii = ipt.current, oo = opt.current;
    if (ii !== null && oo !== null) {
      ctx.fillStyle = "rgba(124,58,237,0.25)";
      ctx.fillRect((ii / d) * w, 0, ((oo - ii) / d) * w, h);
    }
    const vs = vsRef.current, vw = vwRef.current;
    ctx.strokeStyle = "#7c3aed";
    ctx.strokeRect((vs / d) * w, 1, (vw / d) * w, h - 2);
    ctx.fillStyle = "#facc15";
    ctx.fillRect((ph.current / d) * w - 1, 0, 2, h);
  }, []);

  useEffect(() => { draw(); }, [draw, points, duration, clampedVS, zoom, inPoint, outPoint, playhead]);
  useEffect(() => { drawOverview(); }, [drawOverview, points, duration, clampedVS, zoom, inPoint, outPoint, playhead]);
  useEffect(() => {
    const obs = new ResizeObserver(() => { draw(); drawOverview(); });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [draw, drawOverview]);

  // ---- Pixel ↔ time ----
  const pxToTime = (cx: number) => {
    const w = wrapRef.current;
    if (!w) return 0;
    const r = w.getBoundingClientRect();
    const vs = vsRef.current, vw = vwRef.current;
    return vw > 0 ? Math.max(0, Math.min(durRef.current, vs + ((cx - r.left) / r.width) * vw)) : 0;
  };

  const hitTest = (cx: number): "in" | "out" | null => {
    const w = wrapRef.current;
    if (!w) return null;
    const r = w.getBoundingClientRect();
    const d = durRef.current, vw = vwRef.current;
    if (d <= 0 || vw <= 0) return null;
    const pps = r.width / vw, x = cx - r.left, vs = vsRef.current;
    const ii = ipt.current, oo = opt.current;
    if (ii !== null) { const hx = (ii - vs) * pps; if (hx >= -HANDLE_HIT && Math.abs(x - hx) <= HANDLE_HIT) return "in"; }
    if (oo !== null) { const hx = (oo - vs) * pps; if (hx >= -HANDLE_HIT && Math.abs(x - hx) <= HANDLE_HIT) return "out"; }
    return null;
  };

  // ---- Mouse handlers ----
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const h = hitTest(e.clientX);
    if (h) { mode.current = "dragging"; dragWhich.current = h; }
    else {
      mode.current = "maybeDrag"; dragWhich.current = null;
      dragStartX.current = e.clientX; dragStartT.current = pxToTime(e.clientX);
      onSeek(dragStartT.current);
    }
  };

  const onHover = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.cursor = hitTest(e.clientX) ? "ew-resize" : "default";
  };

  const onMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  onMoveRef.current = (e: MouseEvent) => {
    if (mode.current === "idle") return;
    if (mode.current === "maybeDrag") {
      if (Math.abs(e.clientX - dragStartX.current) < 3) return;
      const t = pxToTime(e.clientX);
      if (Math.abs(t - dragStartT.current) < DRAG_THRESHOLD) return;
      mode.current = "dragging";
      const s = Math.min(dragStartT.current, t), en = Math.max(dragStartT.current, t);
      onRegionChange(Math.max(0, s), Math.min(durRef.current, en));
      return;
    }
    const t = pxToTime(e.clientX), d = durRef.current, wh = dragWhich.current;
    if (wh === "in" && opt.current !== null) onRegionChange(Math.max(0, Math.min(t, opt.current - 0.01)), opt.current);
    else if (wh === "out" && ipt.current !== null) onRegionChange(ipt.current, Math.max(ipt.current + 0.01, Math.min(t, d)));
    else if (wh === null) { const s = Math.min(dragStartT.current, t), en = Math.max(dragStartT.current, t); onRegionChange(Math.max(0, s), Math.min(d, en)); }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => onMoveRef.current(e);
    const onUp = () => { mode.current = "idle"; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ---- Zoom (Ctrl+scroll, centered on cursor) ----
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const d = durRef.current;
    if (d <= 0) return;

    const cursorT = pxToTime(e.clientX);
    // Ratio before zoom (relative to visible window)
    const beforeRatio = (cursorT - clampedVS) / visWindow;

    const cur = zm.current;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (e.deltaY < 0 ? cur * ZOOM_STEP : cur / ZOOM_STEP)));
    const rounded = Math.round(next * 4) / 4;
    onZoomChange(rounded);

    // After zoom: keep cursor at same visual position
    const newVw = d / rounded;
    setViewStart(Math.max(0, Math.min(d - newVw, cursorT - beforeRatio * newVw)));
  }, [onZoomChange, clampedVS, visWindow, pxToTime]);

  // ---- Overlay helpers ----
  const d = duration, ip = inPoint, op = outPoint;
  const timeToPct = (t: number) => d > 0 && visWindow > 0 ? ((t - clampedVS) / visWindow) * 100 : 0;

  return (
    <div className="waveform-container">
      <div className="waveform-wrap" ref={wrapRef}
        onMouseDown={onMouseDown} onMouseMove={onHover} onWheel={onWheel}>
        <canvas ref={canvasRef} />

        <div className="region-overlay">
          {ip !== null && op !== null && (
            <>
              <div className="dim" style={{ left: 0, width: `${timeToPct(ip)}%` }} />
              <div className="sel" style={{ left: `${timeToPct(ip)}%`, width: `${timeToPct(op) - timeToPct(ip)}%` }} />
              <div className="dim" style={{ left: `${timeToPct(op)}%`, right: 0 }} />
              <div className="handle" style={{ left: `${timeToPct(ip)}%` }} title="入点" />
              <div className="handle out" style={{ left: `${timeToPct(op)}%` }} title="出点" />
            </>
          )}
          {ip !== null && op === null && <div className="marker in" style={{ left: `${timeToPct(ip)}%` }} />}
          {ip === null && op !== null && <div className="marker out" style={{ left: `${timeToPct(op)}%` }} />}
        </div>

        <div className="playhead" style={{ left: d > 0 && visWindow > 0 ? `${((playhead - clampedVS) / visWindow) * 100}%` : 0 }} />
      </div>

      {/* Native scrollbar (only when zoomed) */}
      {zoom > 1 && (
        <div className="native-scrollbar" ref={scrollerRef} onScroll={onScroll}>
          <div style={{ width: `${zoom * 100}%`, height: 1 }} />
        </div>
      )}

      <canvas ref={overviewRef} className="overview-bar" />
    </div>
  );
};