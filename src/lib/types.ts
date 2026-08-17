export const OUTPUT_FORMATS = ["mp3", "wav", "flac", "aac", "ogg", "opus", "m4a", "webm", "mp4"] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type Operation = "convert" | "extract" | "trim" | "split" | "merge";
export type JobStatus = "queued" | "probing" | "ready" | "running" | "completed" | "failed" | "cancelled";

export interface OutputSettings {
  format: OutputFormat;
  bitrateKbps: number;
  sampleRate: 0 | 22050 | 32000 | 44100 | 48000;
  channels: 0 | 1 | 2;
}

export interface TrimSettings {
  start: number;
  end: number | null;
}

export type SplitSettings =
  | { mode: "markers"; markers: number[] }
  | { mode: "equal"; parts: number };

export interface TransformSettings {
  speed: number;
  pitchSemitones: number;
  gainDb: number;
  bassBoostDb: number;
  trebleDb: number;
  normalize: boolean;
  loudnessTarget: -14 | -16 | -23;
  voiceCleanup: boolean;
  compressor: boolean;
  echo: boolean;
  reverse: boolean;
  fadeIn: number;
  fadeOut: number;
}

export interface RecipeV1 {
  version: 1;
  id: string;
  operation: Operation;
  output: OutputSettings;
  trim: TrimSettings;
  split: SplitSettings;
  transforms: TransformSettings;
  createdAt: number;
  updatedAt: number;
}

export interface LocalMediaRef {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  duration?: number;
  hasVideo?: boolean;
}

export interface OutputRef {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface JobError {
  code: "invalid-input" | "unsupported" | "storage" | "engine" | "cancelled" | "unknown";
  message: string;
  detail?: string;
}

export interface Job {
  id: string;
  recipe: RecipeV1;
  inputs: LocalMediaRef[];
  outputs: OutputRef[];
  status: JobStatus;
  progress: number;
  phase: string;
  error?: JobError;
  createdAt: number;
  updatedAt: number;
}

export type WorkerRequest =
  | { requestId: string; type: "load" }
  | { requestId: string; type: "probe"; input: LocalMediaRef }
  | { requestId: string; type: "run"; job: Job }
  | { requestId: string; type: "cancel" }
  | { requestId: string; type: "cleanup"; jobId: string };

export type WorkerResponse =
  | { requestId: string; type: "loaded"; variant: "mt" | "st" }
  | { requestId: string; type: "probe-result"; input: LocalMediaRef }
  | { requestId: string; type: "progress"; progress: number; phase: string }
  | { requestId: string; type: "complete"; outputs: OutputRef[] }
  | { requestId: string; type: "cancelled" }
  | { requestId: string; type: "cleaned" }
  | { requestId: string; type: "error"; error: JobError };
