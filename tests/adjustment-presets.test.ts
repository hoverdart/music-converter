import { describe, expect, it } from "vitest";
import { activeAdjustmentPreset, applyAdjustmentPreset } from "@/lib/adjustment-presets";
import { buildCommandPlans } from "@/lib/ffmpeg/command";
import { createRecipe } from "@/lib/recipes";

const context = {
  inputPaths: ["/jobs/one/input.wav"],
  inputNames: ["voice.wav"],
  durations: [30],
  hasVideo: false,
  workDir: "/jobs/one"
};

describe("sound adjustment presets", () => {
  it("starts in the original preset and recognizes custom changes", () => {
    const settings = createRecipe();
    expect(activeAdjustmentPreset(settings)).toBe("original");
    expect(activeAdjustmentPreset({ ...settings, transforms: { ...settings.transforms, pitchSemitones: 2 } })).toBeNull();
  });

  it("applies a predictable voice processing chain", () => {
    const settings = applyAdjustmentPreset(createRecipe({ transforms: { echo: true, bassBoostDb: 18 } }), "voice");
    expect(activeAdjustmentPreset(settings)).toBe("voice");
    expect(settings.output).toMatchObject({ bitrateKbps: 128, sampleRate: 44100, channels: 1 });
    expect(settings.transforms).toMatchObject({ normalize: true, loudnessTarget: -16, voiceCleanup: true, compressor: true, echo: false, bassBoostDb: 0 });
    expect(buildCommandPlans(settings, context)[0].args.join(" ")).toContain("highpass=f=80,afftdn=nf=-25,acompressor=threshold=0.125:ratio=4:attack=5:release=80:makeup=2,loudnorm=I=-16");
  });

  it("resets advanced effects when switching to a simple preset", () => {
    const custom = createRecipe({ transforms: { pitchSemitones: -5, reverse: true, echo: true } });
    const small = applyAdjustmentPreset(custom, "small");
    expect(activeAdjustmentPreset(small)).toBe("small");
    expect(small.output).toMatchObject({ bitrateKbps: 96, sampleRate: 32000, channels: 1 });
    expect(small.transforms).toMatchObject({ pitchSemitones: 0, reverse: false, echo: false, normalize: false });
  });
});
