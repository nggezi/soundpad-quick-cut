import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { spawn } from "node:child_process";
import fs from "node:fs";
import type {
  ExportOptions,
  ExportProgress,
  ProbeResult,
  WaveformPoint,
} from "../shared/types.js";

// ========== Binary resolution ==========
// In packaged apps the binaries live in app.asar.unpacked (Electron cannot
// spawn executables from inside the asar archive), so prefer that path.

function resolveBinary(raw: string): string {
  if (!raw) return raw;
  const unpacked = raw.replace("app.asar", "app.asar.unpacked");
  if (fs.existsSync(unpacked)) return unpacked;
  if (fs.existsSync(raw)) return raw;
  return raw;
}

const ffmpegPath = resolveBinary((ffmpegStatic as string) || "ffmpeg");
const ffprobePath = resolveBinary((ffprobeStatic as any)?.path || "ffprobe");

console.log("[ffmpeg] ffmpeg:", ffmpegPath);
console.log("[ffmpeg] ffprobe:", ffprobePath);

// ========== Helpers ==========

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function runCmd(
  cmd: string,
  args: string[],
  timeoutMs = 30000,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
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
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

function evalFps(expr: string): number | undefined {
  const [a, b] = expr.split("/").map(Number);
  if (!b || !isFinite(a / b)) return undefined;
  return a / b;
}

// ========== Probe ==========

export async function probeMedia(filePath: string): Promise<ProbeResult> {
  const { stdout, stderr, code } = await runCmd(ffprobePath, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  if (code !== 0) {
    throw new Error(`ffprobe failed (exit ${code}): ${stderr.slice(0, 300) || "unknown error"}`);
  }
  const data = JSON.parse(stdout) as { streams?: any[]; format?: any };
  const streams = data.streams || [];
  const audio = streams.find((s) => s.codec_type === "audio");
  const video = streams.find((s) => s.codec_type === "video");
  const format = data.format || {};
  return {
    duration: parseFloat(format.duration || "0") || 0,
    width: video?.width,
    height: video?.height,
    hasAudio: !!audio,
    hasVideo: !!video,
    audioCodec: audio?.codec_name,
    audioSampleRate: audio?.sample_rate ? parseInt(audio.sample_rate) : undefined,
    audioChannels: audio?.channels,
    videoCodec: video?.codec_name,
    fps: video?.avg_frame_rate ? evalFps(video.avg_frame_rate) : undefined,
    format: format.format_name,
    bitrate: format.bit_rate ? parseInt(format.bit_rate) : undefined,
  };
}

// ========== Waveform ==========

export async function getWaveform(
  filePath: string,
  samples: number,
  durationHint?: number,
): Promise<WaveformPoint[]> {
  const targetSamples = clamp(Math.round(samples) || 4000, 256, 20000);
  const duration = Math.max(0, durationHint ?? 0);

  // Aim for ~16 samples per waveform bucket. This keeps memory bounded on
  // long files (8kHz * hours would buffer hundreds of MB) while short clips
  // keep enough temporal resolution.
  const sampleRate = duration > 0
    ? clamp(Math.ceil((targetSamples * 16) / duration), 800, 8000)
    : 8000;

  const args = [
    "-nostdin",
    "-i", filePath,
    "-vn",
    "-ac", "1",
    "-ar", String(sampleRate),
    "-f", "f32le",
    "-hide_banner",
    "-loglevel", "error",
    "pipe:1",
  ];

  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let stderr = "";

    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      console.error("[waveform] spawn error:", err.message);
      resolve([]);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        console.error("[waveform] ffmpeg exit", code, ":", stderr.slice(0, 300));
        resolve([]);
        return;
      }
      const buf = Buffer.concat(chunks);
      const floats = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
      if (floats.length === 0) {
        resolve([]);
        return;
      }
      const bucketSize = Math.max(1, Math.floor(floats.length / targetSamples));
      const points: WaveformPoint[] = [];
      for (let i = 0; i < floats.length; i += bucketSize) {
        let min = 1;
        let max = -1;
        const end = Math.min(i + bucketSize, floats.length);
        for (let j = i; j < end; j++) {
          const v = floats[j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        points.push({ t: i / sampleRate, min, max });
      }
      console.log("[waveform] OK, points:", points.length, "sr:", sampleRate);
      resolve(points);
    });
  });
}

// ========== Export ==========

export async function exportAudio(
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void,
): Promise<void> {
  const { inputPath, start, end, outputPath, format } = opts;
  const duration = Math.max(0.01, end - start);

  const args: string[] = [
    "-hide_banner",
    "-nostdin",
    "-loglevel", "error",
    "-y",
    "-i", inputPath,
    // -ss after -i: decode-accurate start point for audio cuts.
    "-ss", start.toFixed(3),
    "-t", duration.toFixed(3),
    "-vn",
    "-map", "0:a:0?",
  ];

  if (format === "wav") {
    args.push("-ac", String(opts.wavChannels ?? 2), "-ar", String(opts.wavSampleRate ?? 44100), "-c:a", "pcm_s16le");
  } else {
    args.push("-c:a", "libmp3lame", "-b:a", `${opts.mp3Bitrate ?? 192}k`);
  }
  args.push("-progress", "pipe:1", outputPath);

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    let pending = "";
    let lastMs = 0;

    child.stdout.on("data", (d) => {
      pending += d.toString();
      const re = /out_time_ms=(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(pending))) lastMs = parseInt(m[1], 10);
      if (lastMs > 0) {
        onProgress({ percent: Math.min(99, (lastMs / 1000 / duration) * 100), done: false });
      }
      // Drop already-consumed progress keys so the buffer stays small.
      const tail = pending.lastIndexOf("progress=");
      if (tail >= 0) pending = pending.slice(tail);
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        onProgress({ percent: 0, done: true, error: `ffmpeg exited with code ${code}` });
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`));
        return;
      }
      onProgress({ percent: 100, done: true, outputPath });
      resolve();
    });
  });
}
