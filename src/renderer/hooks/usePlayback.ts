import { useCallback, useEffect, useRef, useState } from "react";

export interface PlaybackSelection {
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  fps: number;
}

export function usePlayback(
  videoUrl: string | null,
  getSelection: () => PlaybackSelection,
  onDurationLoaded?: (duration: number) => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const selRef = useRef(getSelection);
  selRef.current = getSelection;
  const durLoadedRef = useRef(onDurationLoaded);
  durLoadedRef.current = onDurationLoaded;

  const previewCheckRef = useRef<(() => void) | null>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playheadListenersRef = useRef(new Set<(t: number, playing: boolean) => void>());
  const playTimingRef = useRef({ playing: false, startWall: 0, startVideo: 0 });
  const lastUiUpdateRef = useRef(0);

  const notifyPlayhead = useCallback((t: number, isPlaying: boolean) => {
    playheadListenersRef.current.forEach((cb) => cb(t, isPlaying));
  }, []);

  const subscribePlayhead = useCallback(
    (cb: (t: number, playing: boolean) => void) => {
      playheadListenersRef.current.add(cb);
      cb(videoRef.current?.currentTime ?? 0, playTimingRef.current.playing);
      return () => {
        playheadListenersRef.current.delete(cb);
      };
    },
    [],
  );

  const playOrPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const { inPoint, outPoint } = selRef.current();
      if (inPoint !== null && (v.currentTime < inPoint || (outPoint !== null && v.currentTime >= outPoint))) {
        v.currentTime = inPoint;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const { duration } = selRef.current();
    const max = duration > 0 ? duration : v.duration;
    v.currentTime = Math.max(0, Math.min(max || 0, t));
    if (playTimingRef.current.playing) {
      playTimingRef.current.startWall = performance.now();
      playTimingRef.current.startVideo = v.currentTime;
    }
    setCurrentTime(v.currentTime);
    notifyPlayhead(v.currentTime, playTimingRef.current.playing);
  }, []);

  const stepFrame = useCallback((dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    const { duration, fps } = selRef.current();
    const max = duration > 0 ? duration : v.duration;
    v.currentTime = Math.max(0, Math.min(max || 0, v.currentTime + dir / (fps || 30)));
    if (playTimingRef.current.playing) {
      playTimingRef.current.startWall = performance.now();
      playTimingRef.current.startVideo = v.currentTime;
    }
    setCurrentTime(v.currentTime);
    notifyPlayhead(v.currentTime, playTimingRef.current.playing);
  }, []);

  const stepSecond = useCallback((dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    const { duration } = selRef.current();
    const max = duration > 0 ? duration : v.duration;
    v.currentTime = Math.max(0, Math.min(max || 0, v.currentTime + dir));
    if (playTimingRef.current.playing) {
      playTimingRef.current.startWall = performance.now();
      playTimingRef.current.startVideo = v.currentTime;
    }
    setCurrentTime(v.currentTime);
    notifyPlayhead(v.currentTime, playTimingRef.current.playing);
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatRef.current) {
      clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
  }, []);

  const startRepeat = useCallback(
    (fn: () => void) => {
      stopRepeat();
      fn();
      repeatRef.current = setInterval(fn, 80);
    },
    [stopRepeat],
  );

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  const previewSelection = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const { inPoint, outPoint } = selRef.current();
    if (inPoint === null || outPoint === null) return;
    if (previewCheckRef.current) v.removeEventListener("timeupdate", previewCheckRef.current);
    v.currentTime = inPoint;
    v.play().catch(() => {});
    const check = () => {
      if (v.currentTime >= outPoint) {
        v.pause();
        v.removeEventListener("timeupdate", check);
        previewCheckRef.current = null;
      }
    };
    previewCheckRef.current = check;
    v.addEventListener("timeupdate", check);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const smoothPosition = () => {
      const t = playTimingRef.current.playing
        ? playTimingRef.current.startVideo + (performance.now() - playTimingRef.current.startWall) / 1000
        : v.currentTime;
      return t;
    };
    const tick = () => {
      const { outPoint } = selRef.current();
      if (outPoint !== null && v.currentTime >= outPoint) {
        v.pause();
        return;
      }
      const t = smoothPosition();
      notifyPlayhead(t, true);
      // UI (timecode) at ~30fps; the playhead itself is driven at 60fps
      // through subscribePlayhead, so this does not make playback stutter.
      const now = performance.now();
      if (now - lastUiUpdateRef.current >= 33) {
        lastUiUpdateRef.current = now;
        setCurrentTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    const onMeta = () => {
      setCurrentTime(0);
      notifyPlayhead(0, false);
      if (selRef.current().duration === 0 && v.duration > 0) {
        durLoadedRef.current?.(v.duration);
      }
    };
    const onPlay = () => {
      playTimingRef.current.playing = true;
      playTimingRef.current.startWall = performance.now();
      playTimingRef.current.startVideo = v.currentTime;
      setPlaying(true);
      notifyPlayhead(playTimingRef.current.startVideo, true);
      raf = requestAnimationFrame(tick);
    };
    const stopPlaying = () => {
      playTimingRef.current.playing = false;
      setPlaying(false);
      cancelAnimationFrame(raf);
      setCurrentTime(v.currentTime);
      notifyPlayhead(v.currentTime, false);
    };
    const onPause = () => {
      stopPlaying();
    };
    const onEnded = () => {
      stopPlaying();
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (previewCheckRef.current && videoRef.current) {
        videoRef.current.removeEventListener("timeupdate", previewCheckRef.current);
        previewCheckRef.current = null;
      }
    };
  }, [videoUrl]);

  return {
    videoRef,
    currentTime,
    playing,
    subscribePlayhead,
    playOrPause,
    seek,
    stepFrame,
    stepSecond,
    startRepeat,
    stopRepeat,
    previewSelection,
  };
}
