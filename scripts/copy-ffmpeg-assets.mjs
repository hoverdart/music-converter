import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRoot = join(root, "public", "ffmpeg");
const assets = [
  ["@ffmpeg/core", "st", ["ffmpeg-core.js", "ffmpeg-core.wasm"]],
  ["@ffmpeg/core-mt", "mt", ["ffmpeg-core.js", "ffmpeg-core.wasm", "ffmpeg-core.worker.js"]]
];

await Promise.all(
  assets.flatMap(([pkg, variant, files]) =>
    files.map(async (file) => {
      const source = join(root, "node_modules", pkg, "dist", "umd", file);
      const destination = join(publicRoot, variant, file);
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination);
    })
  )
);

console.log("Prepared self-hosted ffmpeg.wasm cores.");
