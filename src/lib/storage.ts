import { openDB, type DBSchema } from "idb";
import { validateRecipe } from "./recipes";
import type { Job, RecipeV1 } from "./types";

interface MusicMixerDB extends DBSchema {
  recipes: { key: string; value: RecipeV1; indexes: { "by-updated": number } };
  jobs: { key: string; value: Job; indexes: { "by-created": number } };
}

const database = typeof window === "undefined"
  ? null
  : openDB<MusicMixerDB>("musicmixer", 2, {
      upgrade(db) {
        if (db.objectStoreNames.contains("recipes")) db.deleteObjectStore("recipes");
        if (!db.objectStoreNames.contains("jobs")) {
          const jobs = db.createObjectStore("jobs", { keyPath: "id" });
          jobs.createIndex("by-created", "createdAt");
        }
      }
    });

async function getDatabase() {
  if (!database) throw new Error("Browser storage is unavailable during server rendering.");
  return database;
}

async function opfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not support private local file storage.");
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle("musicmixer", { create: true });
}

async function directoryFor(path: string, create: boolean): Promise<{ directory: FileSystemDirectoryHandle; name: string }> {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error("Invalid local media path.");
  let directory = await opfsRoot();
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create });
  return { directory, name };
}

export async function writeLocalFile(path: string, data: Blob | BufferSource): Promise<void> {
  const { directory, name } = await directoryFor(path, true);
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function readLocalFile(path: string): Promise<File> {
  const { directory, name } = await directoryFor(path, false);
  return (await directory.getFileHandle(name)).getFile();
}

export async function deleteLocalPath(path: string, recursive = false): Promise<void> {
  const { directory, name } = await directoryFor(path, false);
  await directory.removeEntry(name, { recursive });
}

export async function persistJob(job: Job): Promise<void> {
  await (await getDatabase()).put("jobs", job);
}

export async function loadJobs(): Promise<Job[]> {
  const jobs = await (await getDatabase()).getAllFromIndex("jobs", "by-created");
  return jobs.reverse().map((job) => {
    const restored = { ...job, recipe: validateRecipe(job.recipe) };
    return ["probing", "running"].includes(restored.status)
      ? { ...restored, status: "ready" as const, phase: "Interrupted — ready to restart", progress: 0 }
      : restored;
  });
}

export async function deleteJob(jobId: string): Promise<void> {
  await (await getDatabase()).delete("jobs", jobId);
  try {
    await deleteLocalPath(`jobs/${jobId}`, true);
  } catch {
    // Already removed or storage was cleared by the browser.
  }
}

export async function clearLocalMedia(): Promise<void> {
  await (await getDatabase()).clear("jobs");
  try {
    await deleteLocalPath("jobs", true);
  } catch {
    // No media has been staged yet.
  }
}

export async function storageSnapshot(): Promise<{ usage: number; quota: number; persistent: boolean }> {
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    persistent: (await navigator.storage.persisted?.()) ?? false
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage.persist?.()) ?? false;
}
