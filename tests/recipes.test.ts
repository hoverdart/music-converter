import { describe, expect, it } from "vitest";
import { createRecipe, validateRecipe } from "@/lib/recipes";

describe("processing settings schema", () => {
  it("creates valid versioned settings with every audio transform disabled", () => {
    const settings = createRecipe();
    expect(validateRecipe(settings)).toEqual(settings);
    expect(settings.version).toBe(1);
    expect(settings.transforms).toMatchObject({ pitchSemitones: 0, bassBoostDb: 0, trebleDb: 0, voiceCleanup: false, compressor: false, echo: false, reverse: false });
  });

  it("restores new transform defaults on jobs created by the previous schema", () => {
    const settings = createRecipe();
    const legacy = { ...settings, transforms: { speed: 1, gainDb: 0, normalize: false, loudnessTarget: -16, fadeIn: 0, fadeOut: 0 } };
    expect(validateRecipe(legacy).transforms).toMatchObject({ pitchSemitones: 0, bassBoostDb: 0, trebleDb: 0, voiceCleanup: false, compressor: false, echo: false, reverse: false });
  });

  it("rejects invalid and incompatible settings", () => {
    const recipe = createRecipe();
    expect(() => validateRecipe({ ...recipe, version: 2 })).toThrow("Unsupported recipe version");
    expect(() => validateRecipe({ ...recipe, transforms: { ...recipe.transforms, normalize: true, gainDb: 4 } })).toThrow("cannot be combined");
    expect(() => validateRecipe({ ...recipe, operation: "extract", output: { ...recipe.output, format: "mp4" } })).toThrow("audio output format");
    expect(() => validateRecipe({ ...recipe, transforms: { ...recipe.transforms, speed: 12 } })).toThrow("Speed must be between");
    expect(() => validateRecipe({ ...recipe, transforms: { ...recipe.transforms, pitchSemitones: 13 } })).toThrow("Pitch must be between");
    expect(() => validateRecipe({ ...recipe, transforms: { ...recipe.transforms, bassBoostDb: 19 } })).toThrow("Bass boost");
    expect(() => validateRecipe({ ...recipe, operation: "split", split: { mode: "equal", parts: 100 } })).toThrow("between 2 and 50");
  });
});
