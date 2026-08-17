import { expect, test } from "@playwright/test";

function waveFixture(seconds = 1): Buffer {
  const sampleRate = 8000;
  const sampleCount = sampleRate * seconds;
  const dataLength = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 6000), 44 + index * 2);
  }
  return buffer;
}

test("presents a private, tool-first responsive workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your audio/ })).toBeVisible();
  await expect(page.getByText("No uploads")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build workflow" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Convert", exact: true })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: /^Original/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Music/ }).click();
  await page.getByRole("button", { name: /^FLAC/ }).click();
  await expect(page.getByRole("button", { name: /^Music/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Pitch")).toBeHidden();
  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByLabel("Pitch")).toBeVisible();
  await page.getByLabel("Bass boost").fill("18");
  await expect(page.getByText("Oh my god", { exact: true })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByAltText("Shaurya's penguin icon")).toBeVisible();
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByLabel("Method")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Local queue" })).toBeVisible();
});

test("accepts a local file and exposes practical audio adjustments", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"][accept*="audio"]')
    .setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: waveFixture() });
  await expect(page.getByText("tone.wav")).toBeVisible();
  await page.getByRole("button", { name: /^Voice/ }).click();
  await expect(page.getByRole("button", { name: /^Voice/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("128 kbps · Mono", { exact: true })).toBeVisible();
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("Pitch").fill("3");
  await page.getByLabel("Voice cleanup").check();
  await page.getByLabel("Dynamic compressor").check();
  await expect(page.getByText("+3 semitones", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Voice cleanup", { exact: true })).toHaveCount(2);
});

test("processes a generated WAV locally without uploading media", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Run the real WebAssembly smoke test once in desktop Chromium.");
  test.setTimeout(180_000);
  const mediaRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") mediaRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/");
  await page.locator('input[type="file"][accept*="audio"]')
    .setInputFiles([
      { name: "private-tone.wav", mimeType: "audio/wav", buffer: waveFixture() },
      { name: "second-tone.wav", mimeType: "audio/wav", buffer: waveFixture() }
    ]);
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("Pitch").fill("5");
  await page.getByLabel("Bass boost").fill("8");
  await page.getByLabel("Treble").fill("3");
  await page.getByLabel("Voice cleanup").check();
  await page.getByLabel("Dynamic compressor").check();
  await page.getByLabel("Echo").check();
  await page.getByLabel("Reverse audio").check();
  await page.getByRole("button", { name: /Add to local queue/ }).click();
  await expect(page.locator(".job-status")).toHaveCount(2);
  await expect.poll(async () => page.locator(".job-status").allTextContents(), { timeout: 170_000 }).toEqual(["completed", "completed"]);
  if (await page.locator(".job-status.failed").count()) {
    throw new Error(`Browser FFmpeg failed: ${JSON.stringify(await page.locator(".job-error").getAttribute("title"))}`);
  }
  await expect(page.getByText("Ready to download")).toHaveCount(2);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp3$/);
  expect(mediaRequests).toEqual([]);
});

test("fails closed for corrupted media", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Exercise the engine error path once in desktop Chromium.");
  test.setTimeout(90_000);
  await page.goto("/");
  await page.locator('input[type="file"][accept*="audio"]')
    .setInputFiles({ name: "broken.wav", mimeType: "audio/wav", buffer: Buffer.from("not a wave file") });
  await page.getByRole("button", { name: /Add to local queue/ }).click();
  await expect(page.locator(".job-status.failed")).toBeVisible({ timeout: 80_000 });
  await expect(page.getByText("FFmpeg could not process this file.")).toBeVisible();
});

test("explains storage and URL-import boundaries", async ({ page }) => {
  await page.goto("/privacy/");
  await expect(page.getByRole("heading", { name: "Your media stays yours." })).toBeVisible();
  await expect(page.getByText(/does not download media from YouTube/)).toBeVisible();
});

test("tells the MusicMixer story and links to Shaurya's website", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
  await expect(page.getByRole("banner").getByRole("link", { name: "About" })).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: /Created by Shaurya/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The bot grew up." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "It started with a taco." })).toBeVisible();
  await expect(page.getByAltText("The original MusicMixer Discord bot artwork from 2020")).toBeVisible();
  await expect(page.getByAltText("Preview of Shaurya Verma's personal website")).toBeVisible();
  await expect(page.getByText(/push the bass all the way to/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /Created by Shaurya/ })).toHaveAttribute("href", "https://www.shauryav.com");
});
