/// <reference lib="webworker" />

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { buildCommandPlans } from "../lib/ffmpeg/command";
import { extensionOf } from "../lib/formats";
import type { JobError, LocalMediaRef, OutputRef, WorkerRequest, WorkerResponse } from "../lib/types";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let ffmpeg = new FFmpeg();
let loadedVariant: "mt" | "st" | null = null;
let activeRequestId: string | null = null;
let cancelled = false;
let recentLogs: string[] = [];

function respond(response: WorkerResponse) {
  scope.postMessage(response);
}

async function opfsFile(path: string): Promise<File> {
  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error("Invalid local file path.");
  let directory = await (await navigator.storage.getDirectory()).getDirectoryHandle("musicmixer", { create: true });
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  return (await directory.getFileHandle(fileName)).getFile();
}

async function writeOpfs(path: string, data: Uint8Array): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error("Invalid output path.");
  let directory = await (await navigator.storage.getDirectory()).getDirectoryHandle("musicmixer", { create: true });
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data as unknown as BufferSource);
  await writable.close();
}

async function deleteOpfsPath(path: string, recursive = false): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  const entry = parts.pop();
  if (!entry) return;
  let directory = await (await navigator.storage.getDirectory()).getDirectoryHandle("musicmixer", { create: true });
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  await directory.removeEntry(entry, { recursive });
}

async function ensureDirectory(path: string): Promise<void> {
  const segments = path.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    try {
      await ffmpeg.createDir(current);
    } catch {
      // Directory already exists in the in-memory filesystem.
    }
  }
}

async function loadEngine(): Promise<"mt" | "st"> {
  if (loadedVariant) return loadedVariant;
  const useThreads = scope.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined";
  const variant = useThreads ? "mt" : "st";
  const base = `${scope.location.origin}/ffmpeg/${variant}`;
  ffmpeg.on("log", ({ message }) => {
    recentLogs.push(message);
    if (recentLogs.length > 30) recentLogs.shift();
  });
  await ffmpeg.load({
    coreURL: `${base}/ffmpeg-core.js`,
    wasmURL: `${base}/ffmpeg-core.wasm`,
    ...(useThreads ? { workerURL: `${base}/ffmpeg-core.worker.js` } : {})
  });
  loadedVariant = variant;
  return variant;
}

async function stageInput(input: LocalMediaRef, wasmPath: string): Promise<void> {
  const file = await opfsFile(input.path);
  await ffmpeg.writeFile(wasmPath, new Uint8Array(await file.arrayBuffer()));
}

async function validateStaged(wasmPath: string, validationPath: string): Promise<void> {
  const exitCode = await ffmpeg.exec([
    "-v", "error",
    "-i", wasmPath,
    "-map", "0:a:0",
    "-frames:a", "1",
    "-f", "wav",
    validationPath
  ]);
  if (exitCode !== 0) throw new Error(`The input has no supported audio stream (FFmpeg code ${exitCode}).`);
  await ffmpeg.deleteFile(validationPath);
}

async function probeStaged(input: LocalMediaRef, wasmPath: string, probePath: string): Promise<LocalMediaRef> {
  const exitCode = await ffmpeg.ffprobe([
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type",
    "-of", "json",
    wasmPath,
    "-o", probePath
  ]);
  if (exitCode !== 0) throw new Error(`FFprobe exited with code ${exitCode}.`);
  const raw = await ffmpeg.readFile(probePath, "utf8");
  const data = JSON.parse(String(raw)) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string }> };
  await ffmpeg.deleteFile(probePath);
  return {
    ...input,
    duration: Number(data.format?.duration) || input.duration,
    hasVideo: data.streams?.some((stream) => stream.codec_type === "video") ?? false
  };
}

function toError(error: unknown): JobError {
  const message = error instanceof Error ? error.message : String(error);
  const detail = [message, ...recentLogs].join("\n");
  if (/memory|abort\(OOM\)/i.test(message)) return { code: "engine", message: "This job exceeded the browser's available memory.", detail };
  if (/quota|storage/i.test(message)) return { code: "storage", message: "There is not enough local browser storage for this job.", detail };
  return { code: "engine", message: "FFmpeg could not process this file.", detail };
}

async function handleProbe(requestId: string, input: LocalMediaRef) {
  await loadEngine();
  const dir = `/probe-${requestId}`;
  await ensureDirectory(dir);
  const inputPath = `${dir}/input.${extensionOf(input.name)}`;
  try {
    await stageInput(input, inputPath);
    let result = input;
    try {
      result = await probeStaged(input, inputPath, `${dir}/probe.json`);
    } catch {
      await validateStaged(inputPath, `${dir}/validation.wav`);
    }
    respond({ requestId, type: "probe-result", input: result });
  } finally {
    try { await ffmpeg.deleteFile(inputPath); } catch {}
  }
}

async function handleRun(requestId: string, job: import("../lib/types").Job) {
  activeRequestId = requestId;
  cancelled = false;
  recentLogs = [];
  await loadEngine();
  const workDir = `/jobs/${job.id}`;
  await ensureDirectory(workDir);
  respond({ requestId, type: "progress", progress: 0.02, phase: "Inspecting local media" });

  const inputPaths: string[] = [];
  const probedInputs: LocalMediaRef[] = [];
  for (let index = 0; index < job.inputs.length; index += 1) {
    const input = job.inputs[index];
    const path = `${workDir}/input-${index}.${extensionOf(input.name)}`;
    await stageInput(input, path);
    await validateStaged(path, `${workDir}/validation-${index}.wav`);
    inputPaths.push(path);
    // Browser media metadata is persisted with the job. Conversion itself does
    // not depend on ffprobe, which is unavailable in a few compatible cores.
    probedInputs.push(input);
  }

  const plans = buildCommandPlans(job.recipe, {
    inputPaths,
    inputNames: probedInputs.map((input) => input.name),
    durations: probedInputs.map((input) => input.duration || 0),
    hasVideo: probedInputs.some((input) => input.hasVideo),
    workDir
  });

  const outputs: OutputRef[] = [];
  let succeeded = false;
  let currentPlan = 0;
  const progressListener = ({ progress }: { progress: number }) => {
    const overall = (currentPlan + Math.max(0, Math.min(1, progress))) / plans.length;
    respond({ requestId, type: "progress", progress: 0.08 + overall * 0.88, phase: `Processing output ${currentPlan + 1} of ${plans.length}` });
  };
  ffmpeg.on("progress", progressListener);

  try {
    for (currentPlan = 0; currentPlan < plans.length; currentPlan += 1) {
      if (cancelled) throw new Error("Job cancelled");
      const plan = plans[currentPlan];
      const exitCode = await ffmpeg.exec(plan.args);
      if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}.`);
      const outputData = await ffmpeg.readFile(plan.outputPath);
      if (typeof outputData === "string") throw new Error("FFmpeg returned an invalid binary output.");
      const localPath = `jobs/${job.id}/outputs/${plan.outputName}`;
      await writeOpfs(localPath, outputData);
      outputs.push({
        id: crypto.randomUUID(),
        name: plan.outputName,
        path: localPath,
        size: outputData.byteLength,
        mimeType: plan.mimeType
      });
      await ffmpeg.deleteFile(plan.outputPath);
    }
    respond({ requestId, type: "progress", progress: 1, phase: "Saved locally" });
    succeeded = true;
    respond({ requestId, type: "complete", outputs });
  } finally {
    ffmpeg.off("progress", progressListener);
    for (const inputPath of inputPaths) {
      try { await ffmpeg.deleteFile(inputPath); } catch {}
    }
    try {
      const nodes = await ffmpeg.listDir(workDir);
      for (const node of nodes) {
        if (![".", ".."].includes(node.name) && !node.isDir) await ffmpeg.deleteFile(`${workDir}/${node.name}`);
      }
      await ffmpeg.deleteDir(workDir);
    } catch {}
    if (!succeeded) {
      try { await deleteOpfsPath(`jobs/${job.id}/outputs`, true); } catch {}
    }
    activeRequestId = null;
  }
}

scope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void (async () => {
    try {
      if (request.type === "load") {
        respond({ requestId: request.requestId, type: "loaded", variant: await loadEngine() });
      } else if (request.type === "probe") {
        await handleProbe(request.requestId, request.input);
      } else if (request.type === "run") {
        await handleRun(request.requestId, request.job);
      } else if (request.type === "cancel") {
        cancelled = true;
        if (activeRequestId) {
          ffmpeg.terminate();
          ffmpeg = new FFmpeg();
          loadedVariant = null;
        }
        respond({ requestId: request.requestId, type: "cancelled" });
      } else if (request.type === "cleanup") {
        respond({ requestId: request.requestId, type: "cleaned" });
      }
    } catch (error) {
      if (cancelled && activeRequestId === request.requestId) {
        respond({ requestId: request.requestId, type: "cancelled" });
      } else {
        respond({ requestId: request.requestId, type: "error", error: toError(error) });
      }
    }
  })();
});

export {};
