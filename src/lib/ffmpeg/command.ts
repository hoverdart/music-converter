import { FORMAT_PRESETS, extensionOf, safeBaseName } from "../formats";
import type { Job, OutputFormat, RecipeV1 } from "../types";

export interface CommandPlan {
  args: string[];
  outputPath: string;
  outputName: string;
  mimeType: string;
  estimatedDuration: number;
  expensiveVideoTranscode: boolean;
}

export interface CommandContext {
  inputPaths: string[];
  inputNames: string[];
  durations: number[];
  hasVideo: boolean;
  workDir: string;
}

interface Segment {
  start: number;
  end: number;
}

function numberArg(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function atempoFilters(speed: number): string[] {
  if (speed <= 0) throw new Error("Speed must be greater than zero.");
  const filters: string[] = [];
  let remaining = speed;
  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 0.001) filters.push(`atempo=${numberArg(remaining)}`);
  return filters;
}

export function effectiveDuration(recipe: RecipeV1, durations: number[]): number {
  const source = recipe.operation === "merge" ? durations.reduce((sum, item) => sum + item, 0) : durations[0] || 0;
  const start = recipe.operation === "trim" || recipe.operation === "split" ? Math.max(0, recipe.trim.start) : 0;
  const end = recipe.operation === "trim" || recipe.operation === "split"
    ? Math.min(recipe.trim.end ?? source, source)
    : source;
  return Math.max(0, end - start) / recipe.transforms.speed;
}

export function splitSegments(recipe: RecipeV1, duration: number): Segment[] {
  if (recipe.operation !== "split") return [{ start: 0, end: duration }];
  if (duration <= 0) throw new Error("The file duration is required before splitting.");
  if (recipe.split.mode === "equal") {
    const parts = Math.max(2, Math.min(50, Math.floor(recipe.split.parts)));
    return Array.from({ length: parts }, (_, index) => ({
      start: (duration * index) / parts,
      end: (duration * (index + 1)) / parts
    }));
  }
  const markers = [...new Set(recipe.split.markers)]
    .filter((marker) => marker > 0 && marker < duration)
    .sort((a, b) => a - b);
  const points = [0, ...markers, duration];
  return points.slice(0, -1).map((start, index) => ({ start, end: points[index + 1] }));
}

function audioEncodingArgs(format: OutputFormat, bitrateKbps: number): string[] {
  const preset = FORMAT_PRESETS[format];
  const args = ["-c:a", preset.audioCodec];
  if (!preset.lossless) args.push("-b:a", `${Math.max(32, Math.min(512, bitrateKbps))}k`);
  return args;
}

function audioFilters(recipe: RecipeV1, duration: number): string[] {
  const filters: string[] = [];
  filters.push(...atempoFilters(recipe.transforms.speed));
  if (recipe.transforms.pitchSemitones !== 0) {
    const pitchRatio = 2 ** (recipe.transforms.pitchSemitones / 12);
    filters.push(
      "aresample=48000",
      `asetrate=${Math.round(48000 * pitchRatio)}`,
      "aresample=48000",
      ...atempoFilters(1 / pitchRatio)
    );
  }
  if (recipe.output.sampleRate) filters.push(`aresample=${recipe.output.sampleRate}`);
  if (recipe.output.channels === 1) filters.push("aformat=channel_layouts=mono");
  if (recipe.output.channels === 2) filters.push("aformat=channel_layouts=stereo");
  if (recipe.transforms.voiceCleanup) filters.push("highpass=f=80", "afftdn=nf=-25");
  if (recipe.transforms.bassBoostDb > 0) filters.push(`bass=g=${numberArg(recipe.transforms.bassBoostDb)}:f=110:w=0.6`);
  if (recipe.transforms.trebleDb !== 0) filters.push(`treble=g=${numberArg(recipe.transforms.trebleDb)}:f=3000:w=0.5`);
  if (recipe.transforms.compressor) filters.push("acompressor=threshold=0.125:ratio=4:attack=5:release=80:makeup=2");
  if (recipe.transforms.echo) filters.push("aecho=0.8:0.5:60:0.25");
  if (recipe.transforms.normalize) {
    filters.push(`loudnorm=I=${recipe.transforms.loudnessTarget}:LRA=11:TP=-1.5`);
  } else if (recipe.transforms.gainDb !== 0) {
    filters.push(`volume=${numberArg(recipe.transforms.gainDb)}dB`);
  }
  if (recipe.transforms.reverse) filters.push("areverse");
  if (recipe.transforms.fadeIn > 0) filters.push(`afade=t=in:st=0:d=${numberArg(recipe.transforms.fadeIn)}`);
  if (recipe.transforms.fadeOut > 0 && duration > recipe.transforms.fadeOut) {
    filters.push(`afade=t=out:st=${numberArg(duration - recipe.transforms.fadeOut)}:d=${numberArg(recipe.transforms.fadeOut)}`);
  }
  return filters;
}

export function buildCommandPlans(recipe: RecipeV1, context: CommandContext): CommandPlan[] {
  if (!context.inputPaths.length) throw new Error("At least one input is required.");
  if (recipe.operation === "merge" && context.inputPaths.length < 2) throw new Error("Merge requires at least two inputs.");
  if (recipe.transforms.normalize && recipe.transforms.gainDb !== 0) throw new Error("Normalization and manual gain cannot be combined.");

  const format = recipe.output.format;
  const preset = FORMAT_PRESETS[format];
  const sourceDuration = effectiveDuration(recipe, context.durations);
  const segments = splitSegments(recipe, sourceDuration);
  const baseName = safeBaseName(context.inputNames[0]);
  const outputStem = recipe.operation === "merge" ? `${baseName}-mix` : baseName;
  const includeVideo = Boolean(preset.video && context.hasVideo && recipe.operation !== "merge");
  const sameContainer = extensionOf(context.inputNames[0]) === format;

  return segments.map((segment, segmentIndex) => {
    const outputName = `${outputStem}${segments.length > 1 ? `-${String(segmentIndex + 1).padStart(2, "0")}` : ""}.${format}`;
    const outputPath = `${context.workDir}/${outputName}`;
    const inputArgs: string[] = [];
    const segmentDuration = segment.end - segment.start;
    const trimmedOperation = recipe.operation === "trim" || recipe.operation === "split";
    const sourceStart = trimmedOperation ? recipe.trim.start + segment.start * recipe.transforms.speed : segment.start;
    const sourceLength = segmentDuration * recipe.transforms.speed;

    context.inputPaths.forEach((path, index) => {
      if (includeVideo && index === 0 && (sourceStart > 0 || sourceLength > 0)) {
        if (sourceStart > 0) inputArgs.push("-ss", numberArg(sourceStart));
        if (trimmedOperation || recipe.operation === "split") inputArgs.push("-t", numberArg(sourceLength));
      }
      inputArgs.push("-i", path);
    });

    const graph: string[] = [];
    const sourceLabel = recipe.operation === "merge"
      ? "merged"
      : "0:a:0";
    if (recipe.operation === "merge") {
      graph.push(`${context.inputPaths.map((_, index) => `[${index}:a:0]`).join("")}concat=n=${context.inputPaths.length}:v=0:a=1[merged]`);
    }

    const chain = audioFilters(recipe, segmentDuration);
    if (!includeVideo && (trimmedOperation || recipe.operation === "split")) {
      chain.unshift(`atrim=start=${numberArg(recipe.trim.start + segment.start * recipe.transforms.speed)}:duration=${numberArg(sourceLength)}`, "asetpts=PTS-STARTPTS");
    }
    graph.push(`[${sourceLabel}]${chain.length ? chain.join(",") : "anull"}[audio]`);

    let videoMap = false;
    const videoArgs: string[] = [];
    if (includeVideo) {
      if (recipe.transforms.speed !== 1) {
        graph.push(`[0:v:0]setpts=PTS/${numberArg(recipe.transforms.speed)}[video]`);
        videoArgs.push("-map", "[video]", "-c:v", preset.videoCodec ?? "copy");
      } else {
        videoArgs.push("-map", "0:v:0?", "-c:v", sameContainer ? "copy" : preset.videoCodec ?? "copy");
      }
      videoMap = true;
    }

    const args = [
      ...inputArgs,
      "-filter_complex", graph.join(";"),
      ...(videoMap ? videoArgs : ["-vn"]),
      "-map", "[audio]",
      ...audioEncodingArgs(format, recipe.output.bitrateKbps),
      ...(preset.video ? ["-shortest"] : []),
      ...(["m4a", "mp4"].includes(format) ? ["-movflags", "+faststart"] : []),
      outputPath
    ];

    return {
      args,
      outputPath,
      outputName,
      mimeType: preset.mimeType,
      estimatedDuration: segmentDuration,
      expensiveVideoTranscode: includeVideo && (!sameContainer || recipe.transforms.speed !== 1)
    };
  });
}

export function pipelineSummary(recipe: RecipeV1): string[] {
  const steps = [recipe.operation[0].toUpperCase() + recipe.operation.slice(1)];
  if (recipe.transforms.speed !== 1) steps.push(`${recipe.transforms.speed}× speed`);
  if (recipe.transforms.pitchSemitones) steps.push(`${recipe.transforms.pitchSemitones > 0 ? "+" : ""}${recipe.transforms.pitchSemitones} semitones`);
  if (recipe.output.sampleRate) steps.push(`${recipe.output.sampleRate / 1000} kHz`);
  if (recipe.output.channels) steps.push(recipe.output.channels === 1 ? "Mono" : "Stereo");
  if (recipe.transforms.voiceCleanup) steps.push("Voice cleanup");
  if (recipe.transforms.bassBoostDb) steps.push(`Bass +${recipe.transforms.bassBoostDb} dB`);
  if (recipe.transforms.trebleDb) steps.push(`Treble ${recipe.transforms.trebleDb > 0 ? "+" : ""}${recipe.transforms.trebleDb} dB`);
  if (recipe.transforms.compressor) steps.push("Compressed dynamics");
  if (recipe.transforms.echo) steps.push("Echo");
  if (recipe.transforms.normalize) steps.push(`${recipe.transforms.loudnessTarget} LUFS`);
  else if (recipe.transforms.gainDb) steps.push(`${recipe.transforms.gainDb > 0 ? "+" : ""}${recipe.transforms.gainDb} dB`);
  if (recipe.transforms.fadeIn) steps.push(`${recipe.transforms.fadeIn}s fade in`);
  if (recipe.transforms.fadeOut) steps.push(`${recipe.transforms.fadeOut}s fade out`);
  if (recipe.transforms.reverse) steps.push("Reverse");
  steps.push(`${recipe.output.format.toUpperCase()} output`);
  return steps;
}

export function estimateWorkingBytes(job: Pick<Job, "inputs" | "recipe">): number {
  const inputBytes = job.inputs.reduce((sum, input) => sum + input.size, 0);
  const duration = effectiveDuration(job.recipe, job.inputs.map((input) => input.duration || 0));
  const preset = FORMAT_PRESETS[job.recipe.output.format];
  const predictedOutput = preset.lossless
    ? duration * (job.recipe.output.channels || 2) * (job.recipe.output.sampleRate || 44100) * 2
    : (duration * job.recipe.output.bitrateKbps * 1000) / 8;
  return Math.ceil(inputBytes + Math.max(inputBytes, predictedOutput) + 256 * 1024 * 1024);
}
