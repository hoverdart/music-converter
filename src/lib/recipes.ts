import { AUDIO_FORMATS } from "./formats";
import {
  OUTPUT_FORMATS,
  type Operation,
  type OutputFormat,
  type OutputSettings,
  type RecipeV1,
  type SplitSettings,
  type TransformSettings,
  type TrimSettings
} from "./types";

const operations: Operation[] = ["convert", "extract", "trim", "split", "merge"];

const defaultTransforms: TransformSettings = {
  speed: 1,
  pitchSemitones: 0,
  gainDb: 0,
  bassBoostDb: 0,
  trebleDb: 0,
  normalize: false,
  loudnessTarget: -16,
  voiceCleanup: false,
  compressor: false,
  echo: false,
  reverse: false,
  fadeIn: 0,
  fadeOut: 0
};

export function defaultTransformSettings(): TransformSettings {
  return { ...defaultTransforms };
}

type RecipeOverrides = Omit<Partial<RecipeV1>, "output" | "trim" | "split" | "transforms"> & {
  output?: Partial<OutputSettings>;
  trim?: Partial<TrimSettings>;
  split?: SplitSettings;
  transforms?: Partial<TransformSettings>;
};

export function createRecipe(overrides: RecipeOverrides = {}): RecipeV1 {
  const now = Date.now();
  const base: RecipeV1 = {
    version: 1,
    id: crypto.randomUUID(),
    operation: "convert",
    output: { format: "mp3", bitrateKbps: 192, sampleRate: 0, channels: 0 },
    trim: { start: 0, end: null },
    split: { mode: "markers", markers: [] },
    transforms: defaultTransformSettings(),
    createdAt: now,
    updatedAt: now
  };
  return {
    ...base,
    ...overrides,
    output: { ...base.output, ...overrides.output },
    trim: { ...base.trim, ...overrides.trim },
    split: overrides.split ?? base.split,
    transforms: { ...base.transforms, ...overrides.transforms }
  };
}

export function validateRecipe(value: unknown): RecipeV1 {
  if (!value || typeof value !== "object") throw new Error("Recipe must be an object.");
  const incoming = value as Partial<RecipeV1>;
  const recipe = {
    ...incoming,
    transforms: { ...defaultTransforms, ...(incoming.transforms ?? {}) }
  } as Partial<RecipeV1>;
  if (recipe.version !== 1) throw new Error("Unsupported recipe version.");
  if (!recipe.id || typeof recipe.id !== "string") throw new Error("Recipe id is missing.");
  if (!recipe.operation || !operations.includes(recipe.operation)) throw new Error("Recipe operation is invalid.");
  if (!recipe.output || !OUTPUT_FORMATS.includes(recipe.output.format as OutputFormat)) throw new Error("Output format is invalid.");
  if (recipe.operation === "extract" && !AUDIO_FORMATS.includes(recipe.output.format)) throw new Error("Audio extraction requires an audio output format.");
  if (!recipe.transforms || !recipe.trim || !recipe.split) throw new Error("Recipe settings are incomplete.");
  if (recipe.transforms.normalize && recipe.transforms.gainDb !== 0) throw new Error("Normalization and manual gain cannot be combined.");
  if (!Number.isFinite(recipe.output.bitrateKbps) || recipe.output.bitrateKbps < 32 || recipe.output.bitrateKbps > 1411) throw new Error("Output bitrate is outside the supported range.");
  if (![0, 22050, 32000, 44100, 48000].includes(recipe.output.sampleRate)) throw new Error("Sample rate is invalid.");
  if (![0, 1, 2].includes(recipe.output.channels)) throw new Error("Channel count is invalid.");
  if (!Number.isFinite(recipe.transforms.speed) || recipe.transforms.speed < 0.5 || recipe.transforms.speed > 2) throw new Error("Speed must be between 0.5× and 2×.");
  if (!Number.isFinite(recipe.transforms.pitchSemitones) || recipe.transforms.pitchSemitones < -12 || recipe.transforms.pitchSemitones > 12) throw new Error("Pitch must be between −12 and +12 semitones.");
  if (!Number.isFinite(recipe.transforms.gainDb) || recipe.transforms.gainDb < -18 || recipe.transforms.gainDb > 18) throw new Error("Manual gain is outside the supported range.");
  if (!Number.isFinite(recipe.transforms.bassBoostDb) || recipe.transforms.bassBoostDb < 0 || recipe.transforms.bassBoostDb > 18) throw new Error("Bass boost is outside the supported range.");
  if (!Number.isFinite(recipe.transforms.trebleDb) || recipe.transforms.trebleDb < -12 || recipe.transforms.trebleDb > 12) throw new Error("Treble adjustment is outside the supported range.");
  for (const setting of ["voiceCleanup", "compressor", "echo", "reverse"] as const) {
    if (typeof recipe.transforms[setting] !== "boolean") throw new Error(`The ${setting} setting is invalid.`);
  }
  if (![recipe.transforms.fadeIn, recipe.transforms.fadeOut].every((duration) => Number.isFinite(duration) && duration >= 0 && duration <= 60)) throw new Error("Fade duration is outside the supported range.");
  if (!Number.isFinite(recipe.trim.start) || recipe.trim.start < 0 || (recipe.trim.end !== null && (!Number.isFinite(recipe.trim.end) || recipe.trim.end <= recipe.trim.start))) throw new Error("Trim timestamps are invalid.");
  if (recipe.split.mode === "equal" && (!Number.isInteger(recipe.split.parts) || recipe.split.parts < 2 || recipe.split.parts > 50)) throw new Error("Equal split count must be between 2 and 50.");
  if (recipe.split.mode === "markers" && (!Array.isArray(recipe.split.markers) || recipe.split.markers.some((marker) => !Number.isFinite(marker) || marker <= 0))) throw new Error("Split markers must be positive timestamps.");
  return recipe as RecipeV1;
}
