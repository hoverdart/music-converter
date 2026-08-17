import type { OutputFormat } from "./types";

export interface FormatPreset {
  label: string;
  description: string;
  mimeType: string;
  audioCodec: string;
  videoCodec?: string;
  defaultBitrate: number;
  lossless?: boolean;
  video?: boolean;
}

export const FORMAT_PRESETS: Record<OutputFormat, FormatPreset> = {
  mp3: { label: "MP3", description: "Universal and compact", mimeType: "audio/mpeg", audioCodec: "libmp3lame", defaultBitrate: 192 },
  wav: { label: "WAV", description: "Uncompressed PCM", mimeType: "audio/wav", audioCodec: "pcm_s16le", defaultBitrate: 1411, lossless: true },
  flac: { label: "FLAC", description: "Lossless and tagged", mimeType: "audio/flac", audioCodec: "flac", defaultBitrate: 900, lossless: true },
  aac: { label: "AAC", description: "Raw AAC audio", mimeType: "audio/aac", audioCodec: "aac", defaultBitrate: 192 },
  ogg: { label: "OGG", description: "Open Vorbis audio", mimeType: "audio/ogg", audioCodec: "libvorbis", defaultBitrate: 192 },
  opus: { label: "Opus", description: "Excellent for speech", mimeType: "audio/ogg", audioCodec: "libopus", defaultBitrate: 128 },
  m4a: { label: "M4A", description: "AAC in an Apple-friendly container", mimeType: "audio/mp4", audioCodec: "aac", defaultBitrate: 192 },
  webm: { label: "WebM", description: "Open web audio/video", mimeType: "video/webm", audioCodec: "libopus", videoCodec: "libvpx-vp9", defaultBitrate: 128, video: true },
  mp4: { label: "MP4", description: "H.264 video with AAC audio", mimeType: "video/mp4", audioCodec: "aac", videoCodec: "libx264", defaultBitrate: 192, video: true }
};

export const AUDIO_FORMATS: OutputFormat[] = ["mp3", "wav", "flac", "aac", "ogg", "opus", "m4a"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function safeBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 120) || "musicmixer-output";
}

export function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}
