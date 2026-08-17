import type { Job, JobError, LocalMediaRef, OutputRef, WorkerRequest, WorkerResponse } from "./types";

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number, phase: string) => void;
};

export class EngineClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL("../workers/ffmpeg.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      if (response.type === "progress") {
        pending.onProgress?.(response.progress, response.phase);
        return;
      }
      this.pending.delete(response.requestId);
      if (response.type === "error") pending.reject(Object.assign(new Error(response.error.message), { data: response.error }));
      else pending.resolve(response);
    });
    this.worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "The audio engine stopped unexpectedly.");
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    });
    return this.worker;
  }

  private send(request: WorkerRequest, onProgress?: PendingRequest["onProgress"]): Promise<WorkerResponse> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(request.requestId, { resolve, reject, onProgress });
      worker.postMessage(request);
    });
  }

  async load(): Promise<"mt" | "st"> {
    const response = await this.send({ requestId: crypto.randomUUID(), type: "load" });
    if (response.type !== "loaded") throw new Error("The audio engine did not load.");
    return response.variant;
  }

  async probe(input: LocalMediaRef): Promise<LocalMediaRef> {
    const response = await this.send({ requestId: crypto.randomUUID(), type: "probe", input });
    if (response.type !== "probe-result") throw new Error("The file could not be inspected.");
    return response.input;
  }

  async run(job: Job, onProgress: (progress: number, phase: string) => void): Promise<OutputRef[]> {
    const response = await this.send({ requestId: crypto.randomUUID(), type: "run", job }, onProgress);
    if (response.type !== "complete") throw new Error("The job did not produce an output.");
    return response.outputs;
  }

  async cancel(): Promise<void> {
    const response = await this.send({ requestId: crypto.randomUUID(), type: "cancel" });
    if (response.type !== "cancelled") throw new Error("The job could not be cancelled.");
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    const error = new Error("The audio engine was closed.");
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
  }
}

export function engineError(error: unknown): JobError {
  if (error && typeof error === "object" && "data" in error) return (error as { data: JobError }).data;
  return { code: "engine", message: error instanceof Error ? error.message : "The audio engine encountered an unknown error." };
}
