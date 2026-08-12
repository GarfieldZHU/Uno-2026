import { expect, test } from "@playwright/test";

test("offline table loads the Rust/WASM HUD and exposes a playable hand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("OFFLINE TABLE")).toBeVisible();
  await expect(page.getByText("Rust core · WASM runtime")).toBeVisible();
  await expect(page.getByText(/YOUR HAND/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Draw from the deck" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Call UNO !" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ONLINE LOCKED" })).toBeDisabled();
});
