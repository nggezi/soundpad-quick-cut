import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import type { RefinedWaveform, WaveformPoint } from "../../shared/types.js";
import { fmtTime } from "../lib/time.js";

interface Props {
  points: WaveformPoint[];
  refined: RefinedWaveform | null;
  duration: number;
  inPoint: number | null;
  outPoint: number | null;
  loading: boolean;
  zoom: number;
  onSeek: (t: number) => void;
  onRegionChange: (start: number, end: number) => void;
  onZoomChange: (zoom: number) => void;
  onRefine: (start: number, end: number) => void;
  onPlayhead: (cb: (t: number, playing: boolean) => void) => () => void;
}

const HANDLE_HIT = 14;
const DRAG_THRESHOLD = 0.1;
const ZOOM_MIN = 1;
const ZOOM_MAX = 40;
const ZOOM_STEP = 1.15;

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export const Waveform = memo(function Waveform({
  points,
  refined,
  duration,
  inPoint,
  outPoint,
  loading,
  zoom,
  onSeek,
  onRegionChange,
  onZoomChange,
  onRefine,
  onPlayhead,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const overviewPlayheadRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dimBeforeRef = useRef<HTMLDivElement>(null);
  const selOverlayRef = useRef<HTMLDivElement>(null);
  const dimAfterRef = useRef<HTMLDivElement>(null);
  const handleInRef = useRef<HTMLDivElement>(null);
  const handleOutRef = useRef<HTMLDivElement>(null);
  const markerInRef = useRef<HTMLDivElement>(null);
  const markerOutRef = useRef<HTMLDivElement>(null);
  const hoverLineRef = useRef<HTMLDivElement>(null);
  const hoverTimeRef = useRef<HTMLDivElement>(null);
  const selDurationRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const overviewSizeRef = useRef({ w: 0, h: 0 });

  // ---- Stable refs (latest values without re-render) ----
  const dur = useRef(duration);
  dur.current = duration;
  const ipt = useRef(inPoint);
  ipt.current = inPoint;
  const opt = useRef(outPoint);
  opt.current = outPoint;
  const zm = useRef(zoom);
  zm.current = zoom;
  const pts = useRef(points);
  pts.current = points;
  const refinedRef = useRef(refined);
  refinedRef.current = refined;

  // ---- View panning (via native scrollbar) ----
  const [viewStart, setViewStart] = useState(0);
  const cropRef = useRef(false);

  const visWindow = duration / zoom;
  const clampedVS = Math.max(0, Math.min(viewStart, Math.max(0, duration - visWindow)));

  const vsRef = useRef(clampedVS);
  vsRef.current = clampedVS;
  const vwRef = useRef(visWindow);
  vwRef.current = visWindow;
  const durRef = useRef(duration);
  durRef.current = duration;
  const playingRef = useRef(false);
  const phRef = useRef(0);

  const playVsRef = useRef(0);
  const lastPlayingRef = useRef(false);
  const programmaticScrollRef = useRef(false);

  // ---- Sync viewStart -> scrollbar position ----
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }
    if (cropRef.current) {
      cropRef.current = false;
      return;
    }
    if (zoom <= 1) return;
    const totalW = scroller.scrollWidth - scroller.clientWidth;
    const scrollTarget = totalW * (clampedVS / (duration - visWindow));
    if (Math.abs(scroller.scrollLeft - scrollTarget) > 1) {
      scroller.scrollLeft = scrollTarget;
    }
  }, [clampedVS, visWindow, zoom, duration]);

  // ---- Sync scrollbar -> viewStart ----
  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || zoom <= 1) return;
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }
    const totalW = scroller.scrollWidth - scroller.clientWidth;
    if (totalW <= 0) return;
    const ratio = scroller.scrollLeft / totalW;
    setViewStart(ratio * (duration - visWindow));
    cropRef.current = true;
  }, [duration, visWindow, zoom]);

  // ---- Re-clamp on zoom change ----
  useEffect(() => {
    setViewStart((prev) => {
      const vw = duration / zoom;
      return Math.max(0, Math.min(prev, Math.max(0, duration - vw)));
    });
  }, [zoom, duration]);

  // ---- Dynamic refinement: when paused and zoomed in, ask the parent for a
  //      higher-resolution waveform covering the visible window. ----
  useEffect(() => {
    if (playingRef.current) return;
    if (duration <= 0 || visWindow <= 0 || zoom <= 4) return;
    const ref = refinedRef.current;
    if (ref && ref.start <= clampedVS && ref.end >= clampedVS + visWindow) return;
    const timer = setTimeout(() => {
      if (playingRef.current) return;
      onRefine(clampedVS, clampedVS + visWindow);
    }, 280);
    return () => clearTimeout(timer);
  }, [clampedVS, visWindow, zoom, duration, onRefine]);

  // ---- Drag state ----
  const mode = useRef<"idle" | "maybeDrag" | "dragging">("idle");
  const dragStartX = useRef(0);
  const dragStartT = useRef(0);
  const dragWhich = useRef<"in" | "out" | null>(null);

  // ---- Draw main waveform (view-start is passed in so playback can render
  //      at 60fps without React state updates) ----
  const renderWaveform = useCallback((vs: number) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const cached = canvasSizeRef.current;
    if (cached.w !== w || cached.h !== h) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      cached.w = w;
      cached.h = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const d = durRef.current;
    const p = pts.current;
    if (loading) {
      ctx.fillStyle = cssVar("--accent", "#5b8cff");
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("正在提取音频波形...", w / 2, h / 2);
      return;
    }
    if (p.length === 0 || d === 0) {
      ctx.fillStyle = cssVar("--text-3", "#61708a");
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("无音频波形", w / 2, h / 2);
      return;
    }

    const vw = vwRef.current;
    if (vw <= 0) return;
    const ref = refinedRef.current;
    const useRefined =
      ref && ref.points.length > 0 && ref.start <= vs && ref.end >= vs + vw;
    const drawPts = useRefined ? ref.points : p;
    const ve = vs + vw;
    const pl = drawPts.length;
    const mid = h / 2;
    const bw = Math.max(1, w / pl - 0.5);
    const waveColor = cssVar("--accent", "#5b8cff");
    ctx.fillStyle = waveColor;
    for (let i = 0; i < pl; i++) {
      const pt = drawPts[i];
      if (pt.t < vs || pt.t > ve) continue;
      const amp = Math.max(0.02, Math.abs(pt.max - pt.min));
      ctx.fillRect(((pt.t - vs) / vw) * w, mid - amp * (h * 0.45), bw, amp * (h * 0.45) * 2);
    }
    ctx.fillStyle = cssVar("--text-3", "#61708a");
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const ti = vw > 30 ? 5 : vw > 10 ? 2 : vw > 5 ? 1 : 0.5;
    for (let t = Math.ceil(vs / ti) * ti; t <= ve; t += ti) {
      const x = ((t - vs) / vw) * w;
      ctx.fillRect(x - 0.5, h - 14, 1, 8);
      ctx.fillText(
        `${Math.floor(t / 60)}:${(t % 60).toFixed(ti < 1 ? 1 : 0).padStart(ti < 1 ? 4 : 2, "0")}`,
        x,
        h - 2,
      );
    }
  }, [loading]);

  // ---- Draw overview ----
  const drawOverview = useCallback(() => {
    const canvas = overviewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const cached = overviewSizeRef.current;
    if (cached.w !== w || cached.h !== h) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      cached.w = w;
      cached.h = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const p = pts.current;
    const d = durRef.current;
    if (p.length === 0 || d === 0) return;
    const pl = p.length;
    const mid = h / 2;
    const waveColor = cssVar("--accent", "#5b8cff");
    ctx.fillStyle = waveColor;
    for (let i = 0; i < pl; i++) {
      const pt = p[i];
      const amp = Math.max(0.02, Math.abs(pt.max - pt.min));
      ctx.fillRect((pt.t / d) * w, mid - amp * (h * 0.4), Math.max(0.5, w / pl - 0.5), amp * (h * 0.8));
    }
    const ii = ipt.current;
    const oo = opt.current;
    if (ii !== null && oo !== null) {
      ctx.fillStyle = "rgba(139,92,246,0.25)";
      ctx.fillRect((ii / d) * w, 0, ((oo - ii) / d) * w, h);
    }
    const vs = vsRef.current;
    const vw = vwRef.current;
    ctx.strokeStyle = waveColor;
    ctx.strokeRect((vs / d) * w, 1, (vw / d) * w, h - 2);
  }, []);

  useEffect(() => {
    renderWaveform(clampedVS);
  }, [renderWaveform, points, duration, clampedVS, zoom, inPoint, outPoint]);

  useEffect(() => {
    drawOverview();
  }, [drawOverview, points, duration, clampedVS, zoom, inPoint, outPoint]);

  // ---- Single source of truth for the region overlay + playheads.
  //      Everything is positioned in pixels from the SAME view start, and this
  //      runs on every React render AND every playback frame, so the dim/sel
  //      layers can never drift out of sync with the waveform. ----
  const layoutOverlay = useCallback((t: number, vs: number) => {
    const wrap = wrapRef.current;
    const d = durRef.current;
    const vw = vwRef.current;
    const w = wrap ? wrap.getBoundingClientRect().width : 0;

    const playheadEl = playheadRef.current;
    if (playheadEl) {
      playheadEl.style.transform =
        w > 0 && vw > 0 ? `translateX(${((t - vs) / vw) * w - 1}px)` : "translateX(-1px)";
    }
    const ov = overviewPlayheadRef.current;
    if (ov && ov.parentElement) {
      const ow = ov.parentElement.getBoundingClientRect().width;
      ov.style.transform = d > 0 ? `translateX(${(t / d) * ow - 0.75}px)` : "translateX(0px)";
    }

    const show = (el: HTMLDivElement | null, visible: boolean) => {
      if (el) el.style.display = visible ? "" : "none";
    };
    show(dimBeforeRef.current, false);
    show(selOverlayRef.current, false);
    show(dimAfterRef.current, false);
    show(handleInRef.current, false);
    show(handleOutRef.current, false);
    show(markerInRef.current, false);
    show(markerOutRef.current, false);
    show(selDurationRef.current, false);

    if (w <= 0 || vw <= 0 || d <= 0) return;
    const ip = ipt.current;
    const op = opt.current;
    const t2x = (tt: number) => ((tt - vs) / vw) * w;
    const setLeft = (el: HTMLDivElement | null, x: number) => {
      if (el) el.style.left = `${x}px`;
    };
    const setRect = (el: HTMLDivElement | null, x: number, width: number) => {
      if (el) {
        el.style.left = `${x}px`;
        el.style.width = `${Math.max(0, width)}px`;
        el.style.right = "auto";
      }
    };

    if (ip !== null && op !== null) {
      const xIn = t2x(ip);
      const xOut = t2x(op);
      show(selDurationRef.current, true);
      const durLabel = selDurationRef.current;
      if (durLabel) {
        const text = `${(op - ip).toFixed(2)}s`;
        if (durLabel.dataset.text !== text) {
          durLabel.dataset.text = text;
          durLabel.textContent = text;
        }
        durLabel.style.transform = `translateX(${(xIn + xOut) / 2 - 18}px)`;
      }
      show(dimBeforeRef.current, true);
      setRect(dimBeforeRef.current, 0, xIn);
      show(selOverlayRef.current, true);
      setRect(selOverlayRef.current, xIn, xOut - xIn);
      show(dimAfterRef.current, true);
      setRect(dimAfterRef.current, xOut, w - xOut);
      show(handleInRef.current, true);
      setLeft(handleInRef.current, xIn);
      show(handleOutRef.current, true);
      setLeft(handleOutRef.current, xOut);
    } else if (ip !== null) {
      show(markerInRef.current, true);
      setLeft(markerInRef.current, t2x(ip));
    } else if (op !== null) {
      show(markerOutRef.current, true);
      setLeft(markerOutRef.current, t2x(op));
    }
  }, []);

  // React-render path: keep the overlay in pixel-perfect sync after every
  // state change (zoom, pan, in/out edits, drags).
  useLayoutEffect(() => {
    layoutOverlay(phRef.current, clampedVS);
  }, [layoutOverlay, clampedVS, inPoint, outPoint, duration, zoom, loading]);

  // ---- Playback loop: render waveform + playheads + scrollbar directly at
  //      60fps. Pausing syncs the final view position back to React once. ----
  useEffect(() => {
    return onPlayhead((t, isPlaying) => {
      playingRef.current = isPlaying;
      const d = durRef.current;
      const vw = vwRef.current;
      if (d <= 0 || vw <= 0) {
        phRef.current = t;
        layoutOverlay(t, vsRef.current);
        return;
      }
      phRef.current = t;
      if (isPlaying && vw < d) {
        const vs = Math.max(0, Math.min(d - vw, t - vw / 2));
        playVsRef.current = vs;
        lastPlayingRef.current = true;
        renderWaveform(vs);
        const scroller = scrollerRef.current;
        if (scroller) {
          const totalW = scroller.scrollWidth - scroller.clientWidth;
          if (totalW > 0) {
            programmaticScrollRef.current = true;
            scroller.scrollLeft = totalW * (vs / (d - vw));
          }
        }
        layoutOverlay(t, vs);
      } else {
        if (lastPlayingRef.current) {
          lastPlayingRef.current = false;
          setViewStart(playVsRef.current);
        }
        layoutOverlay(t, vsRef.current);
      }
    });
  }, [onPlayhead, renderWaveform, layoutOverlay]);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      renderWaveform(vsRef.current);
      drawOverview();
      layoutOverlay(phRef.current, vsRef.current);
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [renderWaveform, drawOverview, layoutOverlay]);

  // ---- Pixel <-> time ----
  const pxToTime = (cx: number) => {
    const w = wrapRef.current;
    if (!w) return 0;
    const r = w.getBoundingClientRect();
    const vs = vsRef.current;
    const vw = vwRef.current;
    return vw > 0 ? Math.max(0, Math.min(durRef.current, vs + ((cx - r.left) / r.width) * vw)) : 0;
  };

  const hitTest = (cx: number): "in" | "out" | null => {
    const w = wrapRef.current;
    if (!w) return null;
    const r = w.getBoundingClientRect();
    const d = durRef.current;
    const vw = vwRef.current;
    if (d <= 0 || vw <= 0) return null;
    const pps = r.width / vw;
    const x = cx - r.left;
    const vs = vsRef.current;
    const ii = ipt.current;
    const oo = opt.current;
    if (ii !== null) {
      const hx = (ii - vs) * pps;
      if (hx >= -HANDLE_HIT && Math.abs(x - hx) <= HANDLE_HIT) return "in";
    }
    if (oo !== null) {
      const hx = (oo - vs) * pps;
      if (hx >= -HANDLE_HIT && Math.abs(x - hx) <= HANDLE_HIT) return "out";
    }
    return null;
  };

  // ---- Mouse handlers ----
  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const h = hitTest(e.clientX);
    if (h) {
      mode.current = "dragging";
      dragWhich.current = h;
    } else {
      mode.current = "maybeDrag";
      dragWhich.current = null;
      dragStartX.current = e.clientX;
      dragStartT.current = pxToTime(e.clientX);
      onSeek(dragStartT.current);
    }
  };

  const onHover = (e: ReactMouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.cursor = hitTest(e.clientX) ? "ew-resize" : "default";
  };

  const onHoverMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    onHover(e);
    const wrap = wrapRef.current;
    const line = hoverLineRef.current;
    const time = hoverTimeRef.current;
    if (!wrap || !line || !time) return;
    const r = wrap.getBoundingClientRect();
    const x = e.clientX - r.left;
    line.style.transform = `translateX(${x - 0.5}px)`;
    line.style.opacity = "1";
    time.textContent = fmtTime(pxToTime(e.clientX));
    time.style.left = `${Math.max(2, Math.min(x - 30, r.width - 64))}px`;
    time.style.opacity = "1";
  };

  const onHoverLeave = () => {
    if (hoverLineRef.current) hoverLineRef.current.style.opacity = "0";
    if (hoverTimeRef.current) hoverTimeRef.current.style.opacity = "0";
  };

  const onMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  onMoveRef.current = (e: MouseEvent) => {
    if (mode.current === "idle") return;
    if (mode.current === "maybeDrag") {
      if (Math.abs(e.clientX - dragStartX.current) < 3) return;
      const t = pxToTime(e.clientX);
      if (Math.abs(t - dragStartT.current) < DRAG_THRESHOLD) return;
      mode.current = "dragging";
      const s = Math.min(dragStartT.current, t);
      const en = Math.max(dragStartT.current, t);
      onRegionChange(Math.max(0, s), Math.min(durRef.current, en));
      return;
    }
    const t = pxToTime(e.clientX);
    const d = durRef.current;
    const wh = dragWhich.current;
    if (wh === "in" && opt.current !== null) {
      onRegionChange(Math.max(0, Math.min(t, opt.current - 0.01)), opt.current);
    } else if (wh === "out" && ipt.current !== null) {
      onRegionChange(ipt.current, Math.max(ipt.current + 0.01, Math.min(t, d)));
    } else if (wh === null) {
      const s = Math.min(dragStartT.current, t);
      const en = Math.max(dragStartT.current, t);
      onRegionChange(Math.max(0, s), Math.min(d, en));
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => onMoveRef.current(e);
    const onUp = () => {
      mode.current = "idle";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ---- Zoom (Ctrl+scroll, centered on cursor) ----
  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const d = durRef.current;
      if (d <= 0) return;
      const cursorT = pxToTime(e.clientX);
      const vs = vsRef.current;
      const vw = vwRef.current;
      if (vw <= 0) return;
      const beforeRatio = (cursorT - vs) / vw;
      const cur = zm.current;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, e.deltaY < 0 ? cur * ZOOM_STEP : cur / ZOOM_STEP));
      const rounded = Math.round(next * 4) / 4;
      onZoomChange(rounded);
      const newVw = d / rounded;
      setViewStart(Math.max(0, Math.min(d - newVw, cursorT - beforeRatio * newVw)));
    },
    [onZoomChange, pxToTime],
  );

  return (
    <div className="waveform-container">
      <div
        className="waveform-wrap"
        ref={wrapRef}
        onMouseDown={onMouseDown}
        onMouseMove={onHoverMove}
        onMouseLeave={onHoverLeave}
        onWheel={onWheel}
      >
        <canvas ref={canvasRef} />
        <div ref={hoverLineRef} className="hover-line" />
        <div ref={hoverTimeRef} className="hover-time" />

        <div className="region-overlay">
          <div ref={dimBeforeRef} className="dim" />
          <div ref={selOverlayRef} className="sel" />
          <div ref={dimAfterRef} className="dim" />
          <div ref={handleInRef} className="handle" title="入点" />
          <div ref={handleOutRef} className="handle out" title="出点" />
          <div ref={markerInRef} className="marker in" />
          <div ref={markerOutRef} className="marker out" />
          <div ref={selDurationRef} className="sel-duration" />
        </div>

        <div ref={playheadRef} className="playhead" />
      </div>

      {zoom > 1 && (
        <div className="native-scrollbar" ref={scrollerRef} onScroll={onScroll}>
          <div style={{ width: `${zoom * 100}%`, height: 1 }} />
        </div>
      )}

      <div className="overview-wrap">
        <canvas ref={overviewRef} className="overview-bar" />
        <div ref={overviewPlayheadRef} className="overview-playhead" />
      </div>
    </div>
  );
});
