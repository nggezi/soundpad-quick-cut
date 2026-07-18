import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { spawn } from "node:child_process";
import fs from "node:fs";
import type { ProbeResult, WaveformPoint, ExportOptions, ExportProgress } from "../shared/types.js";

// ========== Resolve binary paths ==========
// In packaged Electron apps, native binaries must be in app.asar.unpacked,
// not inside the asar archive. Electron's ASAR virtual FS makes existsSync
// return true for asar paths, but spawn() fails at runtime.
// Solution: always check for unpacked path first.

function resolvePath(raw: string): string {
  if (!raw) return raw;
  // Always try the unpacked version first (packaged app)
  const unpacked = raw.replace("app.asar", "app.asar.unpacked");
  if (fs.existsSync(unpacked)) return unpacked;
  // Fall back to the original path (dev mode)
  if (fs.existsSync(raw)) return raw;
  // Return original as last resort
  return raw;
}

const ffmpegRaw = (ffmpegStatic as string) || "ffmpeg";
const ffprobeRaw = (ffprobeStatic as any)?.path || "ffprobe";

const ffmpegPath = resolvePath(ffmpegRaw);
const ffprobePath = resolvePath(ffprobeRaw);

console.log("[ffmpeg-service] ffmpeg (raw):", ffmpegRaw);
console.log("[ffmpeg-service] ffmpeg (resolved):", ffmpegPath);
console.log("[ffmpeg-service] ffprobe (raw):", ffprobeRaw);
console.log("[ffmpeg-service] ffprobe (resolved):", ffprobePath);

// ========== Helper: run command ==========

function runCmd(cmd: string, args: string[], timeoutMs = 30000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      console.error("[runCmd] error:", err.message);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

// ========== Probe ==========

export async function probeMedia(filePath: string): Promise<ProbeResult> {
  console.log("[probe] file:", filePath);
  const args = ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath];
  const { stdout, stderr, code } = await runCmd(ffprobePath, args);
  console.log("[probe] exit:", code);
  if (code !== 0) {
    console.error("[probe] stderr:", stderr.slice(0, 500));
    throw new Error(`ffprobe failed (exit ${code}): ${stderr.slice(0, 200)}`);
  }
  const data = JSON.parse(stdout);
  const streams: any[] = data.streams || [];
  const audio = streams.find((s) => s.codec_type === "audio");
  const video = streams.find((s) => s.codec_type === "video");
  const format = data.format || {};
  const fps = video?.avg_frame_rate ? evalFps(video.avg_frame_rate) : undefined;
  const result: ProbeResult = {
    duration: parseFloat(format.duration || "0") || 0,
    width: video?.width,
    height: video?.height,
    hasAudio: !!audio,
    hasVideo: !!video,
    audioCodec: audio?.codec_name,
    audioSampleRate: audio?.sample_rate ? parseInt(audio.sample_rate) : undefined,
    audioChannels: audio?.channels,
    videoCodec: video?.codec_name,
    fps,
    format: format.format_name,
    bitrate: format.bit_rate ? parseInt(format.bit_rate) : undefined,
  };
  console.log("[probe] OK:", result.duration + "s, audio:", result.hasAudio);
  return result;
}

function evalFps(expr: string): number | undefined {
  const [a, b] = expr.split("/").map(Number);
  if (!b || !isFinite(a / b)) return undefined;
  return a / b;
}

// ========== Waveform ==========

export async function getWaveform(filePath: string, samples: number): Promise<WaveformPoint[]> {
  const targetSamples = Math.max(256, Math.min(20000, samples));
  console.log("[waveform] start, target:", targetSamples, "file:", filePath);

  const args = [
    "-i", filePath,
    "-vn",                    // no video
    "-ac", "1",               // mono
    "-ar", "8000",            // 8kHz is enough for waveform
    "-f", "f32le",            // raw float32 PCM
    "-hide_banner",
    "-loglevel", "error",
    "pipe:1",                 // output to stdout
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let stderrBuf = "";

    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => { stderrBuf += d.toString(); });

    child.on("error", (err) => {
      console.error("[waveform] spawn error:", err.message);
      resolve([]); // Don't throw, return empty
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("[waveform] ffmpeg exited", code, ":", stderrBuf.slice(0, 300));
        return resolve([]); // Return empty instead of throwing
      }
      const buf = Buffer.concat(chunks);
      const floats = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
      console.log("[waveform] raw samples:", floats.length);
      if (floats.length === 0) return resolve([]);

      const bucketSize = Math.max(1, Math.floor(floats.length / targetSamples));
      const sampleRate = 8000;
      const points: WaveformPoint[] = [];
      for (let i = 0; i < floats.length; i += bucketSize) {
        let min = 1, max = -1;
        const end = Math.min(i + bucketSize, floats.length);
        for (let j = i; j < end; j++) {
          const v = floats[j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const t = i / sampleRate;
        points.push({ t, min, max });
      }
      console.log("[waveform] OK, points:", points.length);
      resolve(points);
    });
  });
}

// ========== Export ==========

export async function exportAudio(
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void
): Promise<void> {
  const { inputPath, start, end, outputPath, format } = opts;
  const duration = Math.max(0.01, end - start);

  const args: string[] = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3),
    "-i", inputPath,
    "-t", duration.toFixed(3),
    "-vn",
  ];

  if (format === "wav") {
    args.push("-ac", String(opts.wavChannels ?? 2), "-ar", String(opts.wavSampleRate ?? 44100), "-c:a", "pcm_s16le");
  } else {
    args.push("-c:a", "libmp3lame", "-b:a", `${opts.mp3Bitrate ?? 192}k`);
  }
  args.push(outputPath);

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      const m = stderr.match(/time=(\d+):(\d+):([\d.]+)/);
      if (m) {
        const cur = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
        const pct = Math.min(99, Math.max(0, (cur / duration) * 100));
        onProgress({ percent: pct, done: false });
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        onProgress({ percent: 0, done: true, error: `ffmpeg exited with code ${code}` });
        return reject(new Error(`ffmpeg exited with code ${code}`));
      }
      onProgress({ percent: 100, done: true, outputPath });
      resolve();
    });
  });
}
