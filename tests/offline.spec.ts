import { expect, test } from "@playwright/test";

test("setup opens with the requested offline defaults", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("setup-screen")).toBeVisible();
  await expect(page.getByText("Set the table.")).toBeVisible();
  await expect(page.getByLabel("Player count")).toHaveValue("4");
  await expect(page.getByLabel("Default AI pause")).toHaveValue("3");
  await expect(page.getByTestId("pause-Mika")).toHaveValue("3");
  await expect(page.getByRole("button", { name: "ONLINE LOCKED" })).toBeDisabled();
  await page.screenshot({ path: "test-results/offline-setup-desktop.png", fullPage: true });
});

test("starts a three-seat table and keeps the first human actions available", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Player count").selectOption("3");
  await page.getByTestId("pause-Mika").fill("1");
  await page.getByRole("button", { name: "START OFFLINE TABLE" }).click();

  await expect(page.getByText(/MATCH \/ 001 · 3 SEATS/)).toBeVisible();
  await expect(page.getByText(/YOUR HAND/)).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Draw from the deck" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "ONLINE LOCKED" })).toBeDisabled();
  await page.screenshot({ path: "test-results/offline-table-three-seat.png", fullPage: true });
});

test("starts the supported eight-seat table and remains responsive", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Player count").selectOption("8");
  await page.getByLabel("Default AI pause").fill("1");
  await page.getByRole("button", { name: "START OFFLINE TABLE" }).click();

  await expect(page.getByText(/MATCH \/ 001 · 8 SEATS/)).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(8);
  await expect(page.locator(".opponent-row .player-chip")).toHaveCount(7);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText(/YOUR HAND/)).toBeVisible();
  await page.screenshot({ path: "test-results/offline-table-eight-seat-mobile.png", fullPage: true });
});

test("returns to setup without losing the selected table configuration", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Player count").selectOption("5");
  await page.getByRole("button", { name: "START OFFLINE TABLE" }).click();
  await expect(page.getByText(/MATCH \/ 001 · 5 SEATS/)).toBeVisible();
  await page.getByRole("button", { name: "Set up a new table" }).click();
  await expect(page.getByTestId("setup-screen")).toBeVisible();
  await expect(page.getByLabel("Player count")).toHaveValue("5");
});
