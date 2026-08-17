import { describe, expect, it } from "vitest";
import { atempoFilters, buildCommandPlans, effectiveDuration, estimateWorkingBytes, pipelineSummary, splitSegments } from "@/lib/ffmpeg/command";
import { createRecipe } from "@/lib/recipes";

const context = {
  inputPaths: ["/jobs/one/input-0.wav"],
  inputNames: ["Unsafe name; $(oops).wav"],
  durations: [120],
  hasVideo: false,
  workDir: "/jobs/one"
};

describe("FFmpeg command compiler", () => {
  it("builds argument arrays with safe internal and output paths", () => {
    const plans = buildCommandPlans(createRecipe(), context);
    expect(plans).toHaveLength(1);
    expect(plans[0].args).toContain("libmp3lame");
    expect(plans[0].args).toContain("192k");
    expect(plans[0].outputName).toBe("Unsafe-name-oops.mp3");
    expect(plans[0].args.join(" ")).not.toContain("$(oops)");
  });

  it("chains tempo filters within FFmpeg's supported range", () => {
    expect(atempoFilters(4)).toEqual(["atempo=2", "atempo=2"]);
    expect(atempoFilters(0.25)).toEqual(["atempo=0.5", "atempo=0.5"]);
    expect(atempoFilters(1)).toEqual([]);
  });

  it("compiles trim, normalization, channel, rate, and fade in deterministic order", () => {
    const recipe = createRecipe({
      operation: "trim",
      trim: { start: 10, end: 70 },
      output: { format: "opus", bitrateKbps: 128, sampleRate: 48000, channels: 1 },
      transforms: { speed: 2, gainDb: 0, normalize: true, loudnessTarget: -16, fadeIn: 1, fadeOut: 2 }
    });
    const graph = buildCommandPlans(recipe, context)[0].args.join(" ");
    expect(graph).toContain("atrim=start=10:duration=60,asetpts=PTS-STARTPTS,atempo=2,aresample=48000,aformat=channel_layouts=mono,loudnorm=I=-16:LRA=11:TP=-1.5,afade=t=in:st=0:d=1,afade=t=out:st=28:d=2");
    expect(effectiveDuration(recipe, context.durations)).toBe(30);
  });

  it("compiles pitch, tone, cleanup, dynamics, echo, and reverse in deterministic order", () => {
    const recipe = createRecipe({
      transforms: {
        pitchSemitones: 12,
        bassBoostDb: 9,
        trebleDb: 4,
        voiceCleanup: true,
        compressor: true,
        echo: true,
        reverse: true
      }
    });
    const graph = buildCommandPlans(recipe, context)[0].args.join(" ");
    expect(graph).toContain("aresample=48000,asetrate=96000,aresample=48000,atempo=0.5,highpass=f=80,afftdn=nf=-25,bass=g=9:f=110:w=0.6,treble=g=4:f=3000:w=0.5,acompressor=threshold=0.125:ratio=4:attack=5:release=80:makeup=2,aecho=0.8:0.5:60:0.25,areverse");
  });

  it("creates marker and equal split outputs", () => {
    const markerRecipe = createRecipe({ operation: "split", split: { mode: "markers", markers: [30, 90, 30, -4, 200] } });
    expect(splitSegments(markerRecipe, 120)).toEqual([{ start: 0, end: 30 }, { start: 30, end: 90 }, { start: 90, end: 120 }]);
    expect(buildCommandPlans(markerRecipe, context).map((plan) => plan.outputName)).toEqual(["Unsafe-name-oops-01.mp3", "Unsafe-name-oops-02.mp3", "Unsafe-name-oops-03.mp3"]);
    const equalRecipe = createRecipe({ operation: "split", split: { mode: "equal", parts: 4 } });
    expect(splitSegments(equalRecipe, 100)).toHaveLength(4);
  });

  it("uses concat for ordered audio merge", () => {
    const recipe = createRecipe({ operation: "merge", output: { format: "flac", bitrateKbps: 900, sampleRate: 0, channels: 0 } });
    const plan = buildCommandPlans(recipe, {
      ...context,
      inputPaths: ["/one.wav", "/two.mp3"],
      inputNames: ["one.wav", "two.mp3"],
      durations: [10, 20]
    })[0];
    expect(plan.args.join(" ")).toContain("[0:a:0][1:a:0]concat=n=2:v=0:a=1[merged]");
    expect(plan.args).toContain("flac");
  });

  it("marks cross-container video work as expensive and preserves compatible video", () => {
    const webm = createRecipe({ output: { format: "webm", bitrateKbps: 128, sampleRate: 0, channels: 0 } });
    const transcode = buildCommandPlans(webm, { ...context, inputNames: ["clip.mp4"], hasVideo: true })[0];
    expect(transcode.expensiveVideoTranscode).toBe(true);
    expect(transcode.args).toContain("libvpx-vp9");
    const mp4 = createRecipe({ output: { format: "mp4", bitrateKbps: 192, sampleRate: 0, channels: 0 } });
    const copy = buildCommandPlans(mp4, { ...context, inputNames: ["clip.mp4"], hasVideo: true })[0];
    expect(copy.expensiveVideoTranscode).toBe(false);
    expect(copy.args).toContain("copy");
  });

  it("summarizes pipelines and estimates a conservative working set", () => {
    const recipe = createRecipe({ transforms: { speed: 1, gainDb: 0, normalize: true, loudnessTarget: -14, fadeIn: 0, fadeOut: 0 } });
    expect(pipelineSummary(recipe)).toEqual(["Convert", "-14 LUFS", "MP3 output"]);
    expect(estimateWorkingBytes({ recipe, inputs: [{ id: "1", name: "a.wav", path: "", size: 10_000, mimeType: "audio/wav", duration: 60 }] })).toBeGreaterThan(256 * 1024 * 1024);
  });
});
