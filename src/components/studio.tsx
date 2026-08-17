"use client";

import { zipSync } from "fflate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineClient, engineError } from "@/lib/engine-client";
import { ADJUSTMENT_PRESETS, activeAdjustmentPreset, applyAdjustmentPreset } from "@/lib/adjustment-presets";
import { estimateWorkingBytes, pipelineSummary } from "@/lib/ffmpeg/command";
import { AUDIO_FORMATS, FORMAT_PRESETS, extensionOf, formatBytes, formatDuration } from "@/lib/formats";
import { createRecipe, validateRecipe } from "@/lib/recipes";
import {
  clearLocalMedia,
  deleteJob,
  loadJobs,
  persistJob,
  readLocalFile,
  requestPersistentStorage,
  storageSnapshot,
  writeLocalFile
} from "@/lib/storage";
import type { Job, LocalMediaRef, Operation, OutputFormat, RecipeV1 } from "@/lib/types";
import { Icon } from "./icon";
import { SiteHeader } from "./site-header";
import { Waveform } from "./waveform";

const GIB = 1024 ** 3;
const MAX_INPUT_BYTES = 2 * GIB;
const operations: Array<{ id: Operation; label: string }> = [
  { id: "convert", label: "Convert" },
  { id: "extract", label: "Extract" },
  { id: "trim", label: "Trim" },
  { id: "split", label: "Split" },
  { id: "merge", label: "Merge" }
];

interface DraftFile {
  id: string;
  file: File;
  duration?: number;
}

interface StorageState {
  usage: number;
  quota: number;
  persistent: boolean;
}

function initialRecipe(): RecipeV1 {
  return createRecipe({ id: "draft", createdAt: 0, updatedAt: 0 });
}

function bassImpactLabel(value: number): string {
  if (value === 0) return "Clean";
  if (value <= 4) return "Warm";
  if (value <= 8) return "Bassy";
  if (value <= 12) return "Heavy";
  if (value <= 15) return "Rattling";
  return "Oh my god";
}

function InputFileCard({ item, index, merge, onRemove, onMove, onDuration }: {
  item: DraftFile;
  index: number;
  merge: boolean;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuration: (duration: number) => void;
}) {
  const [url] = useState(() => URL.createObjectURL(item.file));
  const isVideo = item.file.type.startsWith("video/");
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <article className="file-card">
      <div className="file-top">
        <div className="file-type">{extensionOf(item.file.name).slice(0, 4)}</div>
        <div className="file-meta">
          <strong title={item.file.name}>{item.file.name}</strong>
          <span>{formatBytes(item.file.size)} · {formatDuration(item.duration)}</span>
        </div>
        <div className="reorder-row">
          {merge && <>
            <button className="icon-button" type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${item.file.name} earlier`}>↑</button>
            <button className="icon-button" type="button" onClick={() => onMove(1)} aria-label={`Move ${item.file.name} later`}>↓</button>
          </>}
          <button className="icon-button" type="button" onClick={onRemove} aria-label={`Remove ${item.file.name}`}><Icon name="close" /></button>
        </div>
      </div>
      <div className="preview-wrap">
        {!isVideo && <Waveform file={item.file} />}
        {url && (isVideo
          ? <video className="media-preview" src={url} controls preload="metadata" onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)} />
          : <audio className="media-preview" src={url} controls preload="metadata" onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)} />)}
      </div>
    </article>
  );
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Studio() {
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [recipe, setRecipe] = useState<RecipeV1>(initialRecipe);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [storage, setStorage] = useState<StorageState>({ usage: 0, quota: 0, persistent: false });
  const [engineVariant, setEngineVariant] = useState<"idle" | "loading" | "mt" | "st" | "error">("idle");
  const [queueTick, setQueueTick] = useState(0);
  const [toast, setToast] = useState<{ message: string; leaving: boolean } | null>(null);
  const toastTimersRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const cancelledJobRef = useRef<string | null>(null);
  const engineRef = useRef<EngineClient | null>(null);

  const notify = useCallback((message: string) => {
    toastTimersRef.current.forEach(window.clearTimeout);
    setToast({ message, leaving: false });
    toastTimersRef.current = [
      window.setTimeout(() => setToast((current) => current?.message === message ? { ...current, leaving: true } : current), 3900),
      window.setTimeout(() => setToast((current) => current?.message === message ? null : current), 4200)
    ];
  }, []);

  useEffect(() => () => {
    toastTimersRef.current.forEach(window.clearTimeout);
  }, []);

  const refreshStorage = useCallback(async () => {
    try { setStorage(await storageSnapshot()); } catch { /* Storage estimates can be unavailable in private browsing. */ }
  }, []);

  useEffect(() => {
    engineRef.current = new EngineClient();
    void loadJobs().then(async (storedJobs) => {
      setJobs(storedJobs);
      setHydrated(true);
      await refreshStorage();
    }).catch((error) => {
      setHydrated(true);
      notify(error instanceof Error ? error.message : "Local storage could not be opened.");
    });
    return () => engineRef.current?.dispose();
  }, [notify, refreshStorage]);

  const runJob = useCallback(async (job: Job) => {
    if (!engineRef.current) return;
    processingRef.current = true;
    const running: Job = { ...job, status: "running", phase: "Loading private audio engine", progress: 0.01, error: undefined, updatedAt: Date.now() };
    setJobs((current) => current.map((item) => item.id === job.id ? running : item));
    await persistJob(running);
    try {
      setEngineVariant("loading");
      const variant = await engineRef.current.load();
      setEngineVariant(variant);
      const outputs = await engineRef.current.run(running, (progress, phase) => {
        setJobs((current) => current.map((item) => item.id === job.id ? { ...item, progress, phase, updatedAt: Date.now() } : item));
      });
      if (cancelledJobRef.current === job.id) return;
      const complete: Job = { ...running, outputs, status: "completed", progress: 1, phase: "Ready to download", updatedAt: Date.now() };
      setJobs((current) => current.map((item) => item.id === job.id ? complete : item));
      await persistJob(complete);
      notify(`${outputs.length} output${outputs.length === 1 ? " is" : "s are"} ready.`);
    } catch (error) {
      if (cancelledJobRef.current === job.id) {
        cancelledJobRef.current = null;
      } else {
        const failed: Job = { ...running, status: "failed", phase: "Processing stopped", error: engineError(error), updatedAt: Date.now() };
        setJobs((current) => current.map((item) => item.id === job.id ? failed : item));
        await persistJob(failed);
      }
    } finally {
      processingRef.current = false;
      setQueueTick((current) => current + 1);
      await refreshStorage();
    }
  }, [notify, refreshStorage]);

  useEffect(() => {
    if (!hydrated || processingRef.current) return;
    const next = jobs.find((job) => job.status === "queued");
    if (!next) return;
    const timeout = window.setTimeout(() => void runJob(next), 0);
    return () => window.clearTimeout(timeout);
  }, [hydrated, jobs, queueTick, runJob]);

  function addFiles(selected: FileList | File[]) {
    const next = Array.from(selected).filter((file) => file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(mp3|wav|flac|aac|ogg|opus|m4a|webm|mp4)$/i.test(file.name));
    const oversized = next.find((file) => file.size >= MAX_INPUT_BYTES);
    if (oversized) {
      notify(`${oversized.name} reaches the browser engine's 2 GB input limit.`);
      return;
    }
    if (!next.length) {
      notify("Choose a supported audio or video file.");
      return;
    }
    setFiles((current) => [...current, ...next.map((file) => ({ id: crypto.randomUUID(), file }))]);
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function chooseOperation(operation: Operation) {
    setRecipe((current) => ({
      ...current,
      operation,
      output: operation === "extract" && !AUDIO_FORMATS.includes(current.output.format)
        ? { ...current.output, format: "m4a", bitrateKbps: FORMAT_PRESETS.m4a.defaultBitrate }
        : current.output,
      updatedAt: Date.now()
    }));
  }

  function chooseOutputFormat(format: OutputFormat) {
    setRecipe((current) => {
      const preset = activeAdjustmentPreset(current);
      const next = { ...current, output: { ...current.output, format, bitrateKbps: FORMAT_PRESETS[format].defaultBitrate }, updatedAt: Date.now() };
      return preset ? applyAdjustmentPreset(next, preset) : next;
    });
  }

  async function enqueue() {
    if (!files.length) return notify("Add at least one file first.");
    if (recipe.operation === "merge" && files.length < 2) return notify("Merge needs two or more files.");
    try { validateRecipe(recipe); } catch (error) { return notify(error instanceof Error ? error.message : "Check the workflow settings."); }

    const groups = recipe.operation === "merge" ? [files] : files.map((file) => [file]);
    const previews = groups.map((group) => ({
      inputs: group.map((item) => ({ size: item.file.size, duration: item.duration })),
      recipe
    })) as Array<Pick<Job, "inputs" | "recipe">>;
    const estimatedBytes = previews.reduce((sum, job) => sum + estimateWorkingBytes(job), 0);
    const freeStorage = Math.max(0, storage.quota - storage.usage);
    const expensiveVideo = FORMAT_PRESETS[recipe.output.format].video && files.some((item) => item.file.type.startsWith("video/") && extensionOf(item.file.name) !== recipe.output.format);
    if ((estimatedBytes > GIB || (freeStorage && estimatedBytes > freeStorage * 0.5) || expensiveVideo) && !window.confirm(`This workflow may use about ${formatBytes(estimatedBytes)} of working storage${expensiveVideo ? " and requires a slow video transcode" : ""}. Continue?`)) return;

    await requestPersistentStorage().catch(() => false);
    const created: Job[] = [];
    try {
      for (const group of groups) {
        const jobId = crypto.randomUUID();
        const inputs: LocalMediaRef[] = [];
        for (const item of group) {
          const inputId = crypto.randomUUID();
          const path = `jobs/${jobId}/inputs/${inputId}.${extensionOf(item.file.name)}`;
          await writeLocalFile(path, item.file);
          inputs.push({ id: inputId, name: item.file.name, path, size: item.file.size, mimeType: item.file.type, duration: item.duration, hasVideo: item.file.type.startsWith("video/") });
        }
        const now = Date.now();
        const job: Job = {
          id: jobId,
          recipe: structuredClone(recipe),
          inputs,
          outputs: [],
          status: "queued",
          progress: 0,
          phase: "Waiting locally",
          createdAt: now,
          updatedAt: now
        };
        await persistJob(job);
        created.push(job);
      }
      setJobs((current) => [...created, ...current]);
      setFiles([]);
      await refreshStorage();
      notify(`${created.length} job${created.length === 1 ? "" : "s"} added to the local queue.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "The files could not be saved locally.");
    }
  }

  async function downloadOutput(job: Job, outputIndex = 0) {
    const output = job.outputs[outputIndex];
    if (!output) return;
    try { triggerDownload(await readLocalFile(output.path), output.name); }
    catch { notify("That output is no longer available in browser storage."); }
  }

  async function downloadAll(job: Job) {
    if (job.outputs.length === 1) return downloadOutput(job);
    const entries: Record<string, Uint8Array> = {};
    for (const output of job.outputs) entries[output.name] = new Uint8Array(await (await readLocalFile(output.path)).arrayBuffer());
    const archive = zipSync(entries, { level: 0 });
    const stem = job.inputs[0]?.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "musicmixer";
    triggerDownload(new Blob([archive.buffer as ArrayBuffer], { type: "application/zip" }), `${stem}-outputs.zip`);
  }

  async function removeJob(jobId: string) {
    await deleteJob(jobId);
    setJobs((current) => current.filter((job) => job.id !== jobId));
    await refreshStorage();
  }

  async function cancelJob(job: Job) {
    cancelledJobRef.current = job.id;
    await engineRef.current?.cancel().catch(() => undefined);
    const cancelled: Job = { ...job, status: "cancelled", progress: 0, phase: "Cancelled", updatedAt: Date.now() };
    setJobs((current) => current.map((item) => item.id === job.id ? cancelled : item));
    await persistJob(cancelled);
  }

  async function retryJob(job: Job) {
    const queued: Job = { ...job, status: "queued", progress: 0, phase: "Waiting locally", error: undefined, updatedAt: Date.now() };
    await persistJob(queued);
    setJobs((current) => current.map((item) => item.id === job.id ? queued : item));
  }

  async function clearMedia() {
    if (!jobs.length || !window.confirm("Remove every locally stored input, output, and job?")) return;
    const running = jobs.find((job) => job.status === "running");
    if (running) {
      cancelledJobRef.current = running.id;
      await engineRef.current?.cancel().catch(() => undefined);
    }
    await clearLocalMedia();
    setJobs([]);
    await refreshStorage();
    notify("All local media and jobs were removed.");
  }

  const workingEstimate = useMemo(() => estimateWorkingBytes({
    recipe,
    inputs: files.map((item) => ({ id: item.id, name: item.file.name, path: "", size: item.file.size, mimeType: item.file.type, duration: item.duration }))
  }), [files, recipe]);
  const availableFormats = recipe.operation === "extract" ? AUDIO_FORMATS : (Object.keys(FORMAT_PRESETS) as OutputFormat[]);
  const selectedAdjustmentPreset = activeAdjustmentPreset(recipe);
  const selectedPresetLabel = ADJUSTMENT_PRESETS.find((preset) => preset.id === selectedAdjustmentPreset)?.label ?? "Custom";
  const storagePercent = storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <>
      <SiteHeader page="studio" />

      <main className="studio" id="workspace">
        <section className="hero">
          <div>
            <p className="eyebrow">Free private audio converter</p>
            <h1>Your audio.<br /><em>Your device.</em></h1>
          </div>
          <div className="hero-copy">
            <p>Convert, trim, split, merge, and enhance audio locally, then leave with exactly the format you need.</p>
            <div className="privacy-row"><span><Icon name="lock" /> No uploads</span><span><Icon name="wifi" /> Works offline</span><span><Icon name="wave" /> Powered by FFmpeg</span></div>
          </div>
        </section>

        <section
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        >
          <input ref={inputRef} type="file" multiple accept="audio/*,video/*,.mp3,.wav,.flac,.aac,.ogg,.opus,.m4a,.webm,.mp4" onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <div className="drop-content">
            <div className="drop-icon"><Icon name="upload" /></div>
            <div><strong>Drop audio or video here</strong><p>or <button type="button" onClick={() => inputRef.current?.click()}>choose files</button> · MP3, WAV, FLAC, AAC, OGG, Opus, M4A, WebM, MP4</p></div>
          </div>
        </section>

        <section className="workspace" aria-label="Audio workflow builder">
          <div className="panel input-panel">
            <div className="panel-header"><div className="panel-heading"><span className="step-number">01</span><h2>Inputs</h2></div><small>{files.length ? `${files.length} selected` : "Local only"}</small></div>
            <div className="panel-body">
              {files.length ? <div className="file-list">{files.map((item, index) => <InputFileCard key={item.id} item={item} index={index} merge={recipe.operation === "merge"} onRemove={() => setFiles((current) => current.filter((file) => file.id !== item.id))} onMove={(direction) => moveFile(index, direction)} onDuration={(duration) => setFiles((current) => current.map((file) => file.id === item.id ? { ...file, duration } : file))} />)}</div>
                : <div className="empty-state"><div><Icon name="folder" /><p>Your selected media will appear here. Nothing is uploaded.</p></div></div>}
            </div>
          </div>

          <div className="panel workflow-panel">
            <div className="panel-header"><div className="panel-heading"><span className="step-number">02</span><h2>Build workflow</h2></div><small>{engineVariant === "idle" ? "Engine loads on demand" : engineVariant === "loading" ? "Loading engine…" : engineVariant === "mt" ? "Multithread engine" : engineVariant === "st" ? "Compatibility engine" : "Engine unavailable"}</small></div>
            <div className="panel-body">
              <div className="operation-grid">{operations.map((operation) => <button key={operation.id} type="button" className={`operation-button ${recipe.operation === operation.id ? "active" : ""}`} onClick={() => chooseOperation(operation.id)}>{operation.label}</button>)}</div>

              <div className="section-label"><strong>Output format</strong><span>{recipe.operation === "extract" ? "Audio formats only" : "9 formats"}</span></div>
              <div className="format-grid">{availableFormats.map((format) => <button key={format} type="button" className={`format-button ${recipe.output.format === format ? "active" : ""}`} onClick={() => chooseOutputFormat(format)}><strong>{FORMAT_PRESETS[format].label}</strong><span>{FORMAT_PRESETS[format].description}</span></button>)}</div>

              {(recipe.operation === "trim" || recipe.operation === "split") && <>
                <div className="section-label"><strong>Timeline</strong><span>Seconds</span></div>
                <div className="control-grid">
                  <div className="field"><label htmlFor="trim-start">Start</label><input id="trim-start" type="number" min="0" step="0.1" value={recipe.trim.start} onChange={(event) => setRecipe((current) => ({ ...current, trim: { ...current.trim, start: Math.max(0, Number(event.target.value)) } }))} /></div>
                  <div className="field"><label htmlFor="trim-end">End (blank = finish)</label><input id="trim-end" type="number" min="0" step="0.1" value={recipe.trim.end ?? ""} onChange={(event) => setRecipe((current) => ({ ...current, trim: { ...current.trim, end: event.target.value ? Number(event.target.value) : null } }))} /></div>
                </div>
              </>}

              {recipe.operation === "split" && <>
                <div className="section-label"><strong>Split method</strong><span>Up to 50 outputs</span></div>
                <div className="control-grid">
                  <div className="field"><label htmlFor="split-mode">Method</label><select id="split-mode" value={recipe.split.mode} onChange={(event) => setRecipe((current) => ({ ...current, split: event.target.value === "equal" ? { mode: "equal", parts: 2 } : { mode: "markers", markers: [] } }))}><option value="markers">At markers</option><option value="equal">Equal parts</option></select></div>
                  {recipe.split.mode === "equal"
                    ? <div className="field"><label htmlFor="split-parts">Number of parts</label><input id="split-parts" type="number" min="2" max="50" value={recipe.split.parts} onChange={(event) => setRecipe((current) => ({ ...current, split: { mode: "equal", parts: Math.max(2, Math.min(50, Number(event.target.value))) } }))} /></div>
                    : <div className="field"><label htmlFor="split-markers">Markers</label><input id="split-markers" placeholder="30, 75, 120" value={recipe.split.markers.join(", ")} onChange={(event) => setRecipe((current) => ({ ...current, split: { mode: "markers", markers: event.target.value.split(",").map(Number).filter((value) => Number.isFinite(value) && value > 0) } }))} /></div>}
                </div>
              </>}

              <div className="section-label"><strong>Sound adjustments</strong><span>Choose a preset or fine-tune</span></div>
              <div className="preset-grid" role="group" aria-label="Sound presets">
                {ADJUSTMENT_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" className={`preset-button ${selectedAdjustmentPreset === preset.id ? "active" : ""}`} aria-pressed={selectedAdjustmentPreset === preset.id} onClick={() => setRecipe((current) => applyAdjustmentPreset(current, preset.id))}>
                    <span className="preset-check"><Icon name={selectedAdjustmentPreset === preset.id ? "check" : "wave"} /></span>
                    <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
                    <em>{preset.detail}</em>
                  </button>
                ))}
              </div>

              <details className="advanced-controls">
                <summary>
                  <span><strong>Advanced</strong><small>Quality, pitch, tone, dynamics, and fades</small></span>
                  <span className="advanced-state">{selectedPresetLabel}<Icon className="advanced-chevron" name="arrow" /></span>
                </summary>
                <div className="advanced-body">
                  <div className="control-grid">
                    <div className="field"><label htmlFor="bitrate">Quality</label><select id="bitrate" disabled={FORMAT_PRESETS[recipe.output.format].lossless} value={recipe.output.bitrateKbps} onChange={(event) => setRecipe((current) => ({ ...current, output: { ...current.output, bitrateKbps: Number(event.target.value) } }))}><option value="96">Small · 96 kbps</option><option value="128">Voice · 128 kbps</option><option value="192">Balanced · 192 kbps</option><option value="256">High · 256 kbps</option><option value="320">Best · 320 kbps</option></select></div>
                    <div className="field"><label htmlFor="sample-rate">Sample rate</label><select id="sample-rate" value={recipe.output.sampleRate} onChange={(event) => setRecipe((current) => ({ ...current, output: { ...current.output, sampleRate: Number(event.target.value) as RecipeV1["output"]["sampleRate"] } }))}><option value="0">Keep original</option><option value="22050">22.05 kHz</option><option value="32000">32 kHz</option><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select></div>
                    <div className="field"><label htmlFor="channels">Channels</label><select id="channels" value={recipe.output.channels} onChange={(event) => setRecipe((current) => ({ ...current, output: { ...current.output, channels: Number(event.target.value) as RecipeV1["output"]["channels"] } }))}><option value="0">Keep original</option><option value="1">Mono</option><option value="2">Stereo</option></select></div>
                    <div className="field"><label htmlFor="speed">Speed <span className="range-value">{recipe.transforms.speed.toFixed(2)}×</span></label><input id="speed" type="range" min="0.5" max="2" step="0.05" value={recipe.transforms.speed} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, speed: Number(event.target.value) } }))} /></div>
                    <div className="field"><label htmlFor="pitch">Pitch <span className="range-value">{recipe.transforms.pitchSemitones > 0 ? "+" : ""}{recipe.transforms.pitchSemitones} semitones</span></label><input id="pitch" type="range" min="-12" max="12" step="1" value={recipe.transforms.pitchSemitones} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, pitchSemitones: Number(event.target.value) } }))} /><div className="range-scale"><span>One octave down</span><span>Original</span><span>One octave up</span></div></div>
                    <div className="field"><label htmlFor="bass">Bass boost <span className="range-value">{bassImpactLabel(recipe.transforms.bassBoostDb)}{recipe.transforms.bassBoostDb ? ` · +${recipe.transforms.bassBoostDb} dB` : ""}</span></label><input id="bass" type="range" min="0" max="18" step="1" value={recipe.transforms.bassBoostDb} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, bassBoostDb: Number(event.target.value) } }))} /><div className="range-scale"><span>Clean</span><span>Bassy</span><span>Oh my god</span></div></div>
                    <div className="field"><label htmlFor="treble">Treble <span className="range-value">{recipe.transforms.trebleDb > 0 ? "+" : ""}{recipe.transforms.trebleDb} dB</span></label><input id="treble" type="range" min="-12" max="12" step="1" value={recipe.transforms.trebleDb} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, trebleDb: Number(event.target.value) } }))} /></div>
                    <div className="field"><label htmlFor="gain">Volume <span className="range-value">{recipe.transforms.gainDb > 0 ? "+" : ""}{recipe.transforms.gainDb} dB</span></label><input id="gain" type="range" min="-18" max="18" step="1" disabled={recipe.transforms.normalize} value={recipe.transforms.gainDb} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, gainDb: Number(event.target.value) } }))} /></div>
                    <div className="switch-field"><div><strong>Normalize loudness</strong><small>Disables manual gain</small></div><label className="switch"><input aria-label="Normalize loudness" type="checkbox" checked={recipe.transforms.normalize} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, normalize: event.target.checked, gainDb: 0 } }))} /><span /></label></div>
                    {recipe.transforms.normalize && <div className="field"><label htmlFor="loudness">Loudness target</label><select id="loudness" value={recipe.transforms.loudnessTarget} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, loudnessTarget: Number(event.target.value) as -14 | -16 | -23 } }))}><option value="-14">Music · −14 LUFS</option><option value="-16">Podcast · −16 LUFS</option><option value="-23">Broadcast · −23 LUFS</option></select></div>}
                    <div className="switch-field"><div><strong>Voice cleanup</strong><small>Reduce steady noise and low rumble</small></div><label className="switch"><input aria-label="Voice cleanup" type="checkbox" checked={recipe.transforms.voiceCleanup} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, voiceCleanup: event.target.checked } }))} /><span /></label></div>
                    <div className="switch-field"><div><strong>Dynamic compressor</strong><small>Even out quiet and loud moments</small></div><label className="switch"><input aria-label="Dynamic compressor" type="checkbox" checked={recipe.transforms.compressor} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, compressor: event.target.checked } }))} /><span /></label></div>
                    <div className="switch-field"><div><strong>Echo</strong><small>Add a short, restrained reflection</small></div><label className="switch"><input aria-label="Echo" type="checkbox" checked={recipe.transforms.echo} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, echo: event.target.checked } }))} /><span /></label></div>
                    <div className="switch-field"><div><strong>Reverse audio</strong><small>Play the entire track backward</small></div><label className="switch"><input aria-label="Reverse audio" type="checkbox" checked={recipe.transforms.reverse} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, reverse: event.target.checked } }))} /><span /></label></div>
                    <div className="field"><label htmlFor="fade-in">Fade in (seconds)</label><input id="fade-in" type="number" min="0" max="60" step="0.1" value={recipe.transforms.fadeIn} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, fadeIn: Math.max(0, Number(event.target.value)) } }))} /></div>
                    <div className="field"><label htmlFor="fade-out">Fade out (seconds)</label><input id="fade-out" type="number" min="0" max="60" step="0.1" value={recipe.transforms.fadeOut} onChange={(event) => setRecipe((current) => ({ ...current, transforms: { ...current.transforms, fadeOut: Math.max(0, Number(event.target.value)) } }))} /></div>
                  </div>
                </div>
              </details>

              <div className="section-label"><strong>Pipeline</strong><span>Review before running</span></div>
              <div className="pipeline">{pipelineSummary(recipe).map((step) => <span className="pipeline-step" key={step}>{step}</span>)}</div>
              <div className="estimate-card"><span>Approximate working storage</span><strong>{files.length ? formatBytes(workingEstimate) : "Add files to estimate"}</strong></div>
              <button className="primary-button" type="button" disabled={!files.length || (recipe.operation === "merge" && files.length < 2)} onClick={() => void enqueue()}><Icon name="spark" /> Add to local queue</button>
            </div>
          </div>

          <div className="panel queue-panel">
            <div className="panel-header"><div className="panel-heading"><span className="step-number">03</span><h2>Local queue</h2></div><small>{jobs.filter((job) => job.status === "completed").length} ready</small></div>
            <div className="panel-body">
              {jobs.length ? <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}><div className="job-top"><div className="job-title"><strong>{job.inputs.map((input) => input.name).join(" + ")}</strong><span>{pipelineSummary(job.recipe).join(" · ")}</span></div><span className={`job-status ${job.status}`}>{job.status}</span></div><div className="progress-track"><span style={{ width: `${Math.round(job.progress * 100)}%` }} /></div><div className="job-phase"><span>{job.phase}</span><span>{Math.round(job.progress * 100)}%</span></div>{job.error && <p className="job-error" title={job.error.detail}>{job.error.message}</p>}<div className="job-actions">{job.status === "completed" && <button type="button" onClick={() => void downloadAll(job)}>{job.outputs.length > 1 ? "Download ZIP" : "Download"}</button>}{job.status === "running" && <button type="button" onClick={() => void cancelJob(job)}>Cancel</button>}{["failed", "cancelled", "ready"].includes(job.status) && <button type="button" onClick={() => void retryJob(job)}>Retry</button>} {job.status !== "running" && <button type="button" onClick={() => void removeJob(job.id)}>Remove</button>}</div></article>)}</div>
                : <div className="empty-state"><div><Icon name="clock" /><p>Queued jobs run one at a time and remain recoverable on this device.</p></div></div>}
              <div className="storage-card"><div className="storage-row"><span>Browser storage</span><span>{formatBytes(storage.usage)} of {storage.quota ? formatBytes(storage.quota) : "unknown"}</span></div><div className="storage-bar"><span style={{ width: `${storagePercent}%` }} /></div><div className="storage-actions"><button className="ghost-button" type="button" onClick={() => void refreshStorage()}><Icon name="refresh" /> Refresh</button><button className="ghost-button danger" type="button" onClick={() => void clearMedia()}><Icon name="trash" /> Clear all media</button></div></div>
            </div>
          </div>
        </section>

        <section className="seo-content" aria-labelledby="private-audio-tools">
          <div className="seo-intro">
            <p className="eyebrow">Private by design</p>
            <h2 id="private-audio-tools">A free online audio converter that never uploads your files.</h2>
            <p>MusicMixer runs FFmpeg directly in your browser. Convert MP3, WAV, FLAC, AAC, OGG, Opus, and M4A audio; extract audio from WebM or MP4 video; or combine conversion with trimming, splitting, merging, loudness normalization, fades, pitch, speed, bass, and voice cleanup.</p>
          </div>
          <div className="seo-points">
            <article>
              <h3>Convert and batch-process</h3>
              <p>Choose an output format and process multiple files with the same private workflow. Completed files download directly from your device.</p>
            </article>
            <article>
              <h3>Edit without an account</h3>
              <p>Trim clips, split at markers, merge tracks in order, normalize volume, clean up speech, and tune quality without signing in.</p>
            </article>
            <article>
              <h3>Keep media on your device</h3>
              <p>Inputs, outputs, and recoverable jobs stay in browser-managed storage. MusicMixer has no media upload endpoint or analytics.</p>
            </article>
          </div>
          <div className="seo-faq">
            <h2>Audio converter FAQ</h2>
            <details>
              <summary>Which audio formats can MusicMixer convert?</summary>
              <p>MusicMixer can create MP3, WAV, FLAC, AAC, OGG, Opus, M4A, WebM, and MP4 files. It can also extract audio from supported audio and video inputs.</p>
            </details>
            <details>
              <summary>Are my audio files uploaded?</summary>
              <p>No. The hosted app processes selected files locally with WebAssembly and stores working media in browser-managed storage on your device.</p>
            </details>
            <details>
              <summary>Can I use the audio converter offline?</summary>
              <p>Yes, after the site and audio engine have been cached. Keep the tab open while a job runs because browsers can suspend work when the app closes.</p>
            </details>
            <details>
              <summary>Is MusicMixer free?</summary>
              <p>Yes. MusicMixer is free to use, requires no account, and is open source.</p>
            </details>
          </div>
        </section>

      </main>
      {toast && <div className={`toast ${toast.leaving ? "leaving" : ""}`} role="status">{toast.message}</div>}
    </>
  );
}
