import { FORMAT_PRESETS } from "./formats";
import { defaultTransformSettings } from "./recipes";
import type { OutputSettings, RecipeV1, TransformSettings } from "./types";

export const ADJUSTMENT_PRESETS = [
  { id: "original", label: "Original", description: "No sound changes", detail: "Keep source" },
  { id: "voice", label: "Voice", description: "Clean, even, and clear", detail: "128 kbps · Mono" },
  { id: "music", label: "Music", description: "Full stereo sound", detail: "256 kbps · −14 LUFS" },
  { id: "small", label: "Small file", description: "Compact mono audio", detail: "96 kbps · 32 kHz" }
] as const;

export type AdjustmentPresetId = (typeof ADJUSTMENT_PRESETS)[number]["id"];

interface PresetValues {
  output: OutputSettings;
  transforms: TransformSettings;
}

function valuesFor(recipe: RecipeV1, preset: AdjustmentPresetId): PresetValues {
  const transforms = defaultTransformSettings();
  const output = { ...recipe.output };

  if (preset === "original") {
    return {
      output: { ...output, bitrateKbps: FORMAT_PRESETS[output.format].defaultBitrate, sampleRate: 0, channels: 0 },
      transforms
    };
  }
  if (preset === "voice") {
    return {
      output: { ...output, bitrateKbps: 128, sampleRate: 44100, channels: 1 },
      transforms: { ...transforms, normalize: true, loudnessTarget: -16, voiceCleanup: true, compressor: true }
    };
  }
  if (preset === "music") {
    return {
      output: { ...output, bitrateKbps: 256, sampleRate: 44100, channels: 2 },
      transforms: { ...transforms, normalize: true, loudnessTarget: -14 }
    };
  }
  return {
    output: { ...output, bitrateKbps: 96, sampleRate: 32000, channels: 1 },
    transforms
  };
}

export function applyAdjustmentPreset(recipe: RecipeV1, preset: AdjustmentPresetId): RecipeV1 {
  return { ...recipe, ...valuesFor(recipe, preset), updatedAt: Date.now() };
}

export function activeAdjustmentPreset(recipe: RecipeV1): AdjustmentPresetId | null {
  for (const preset of ADJUSTMENT_PRESETS) {
    const values = valuesFor(recipe, preset.id);
    if (JSON.stringify(recipe.output) === JSON.stringify(values.output) && JSON.stringify(recipe.transforms) === JSON.stringify(values.transforms)) return preset.id;
  }
  return null;
}
