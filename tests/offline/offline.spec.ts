import { expect, test } from "@playwright/test";

test("caches the production shell for offline use", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Your audio/ })).toBeVisible();
  await expect(page.getByText("No uploads")).toBeVisible();
  await page.goto("/about/");
  await expect(page.getByRole("heading", { name: "The bot grew up." })).toBeVisible();
  await context.setOffline(false);
});
