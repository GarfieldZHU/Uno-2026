import { expect, test } from "@playwright/test";

test("中文是默认界面，并可切换到英文", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("setup-screen")).toBeVisible();
  await expect(page.getByText("设置牌桌")).toBeVisible();
  await expect(page.getByLabel("玩家")).toHaveValue("4");
  await expect(page.getByLabel("AI 默认停顿")).toHaveValue("3");
  await expect(page.getByRole("button", { name: "联机 已锁定" })).toBeDisabled();
  await page.screenshot({ path: "test-results/offline-setup-zh.png", fullPage: true });

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByText("Set the table.")).toBeVisible();
  await expect(page.getByLabel("Player count")).toHaveValue("4");
  await expect(page.getByRole("button", { name: "ONLINE LOCKED" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();
  await page.screenshot({ path: "test-results/offline-setup-language-toggle.png", fullPage: true });
});

test("starts a three-seat table and keeps the first human actions available", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家").selectOption("3");
  await page.getByTestId("pause-Mika").fill("1");
  await page.getByRole("button", { name: "开始离线牌局", exact: false }).click();

  await expect(page.getByText(/牌局 \/ 001 · 3 席/)).toBeVisible();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "从摸牌堆摸牌" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "联机 已锁定" })).toBeDisabled();
  await page.screenshot({ path: "test-results/offline-table-three-seat-zh.png", fullPage: true });
});

test("切换牌桌语言不会改变正在进行的牌局", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始离线牌局", exact: false }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByText("Make your move.")).toBeVisible();
  await expect(page.getByText(/YOUR HAND/)).toBeVisible();
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
});

test("starts the supported eight-seat table and remains responsive", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家").selectOption("8");
  await page.getByLabel("AI 默认停顿").fill("1");
  await page.getByRole("button", { name: "开始离线牌局", exact: false }).click();

  await expect(page.getByText(/牌局 \/ 001 · 8 席/)).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(8);
  await expect(page.locator(".opponent-row .player-chip")).toHaveCount(7);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("你的手牌")).toBeVisible();
  await page.screenshot({ path: "test-results/offline-table-eight-seat-mobile-zh.png", fullPage: true });
});

test("returns to setup without losing the selected table configuration", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("玩家").selectOption("5");
  await page.getByRole("button", { name: "开始离线牌局", exact: false }).click();
  await expect(page.getByText(/牌局 \/ 001 · 5 席/)).toBeVisible();
  await page.getByRole("button", { name: "重新设置牌桌" }).click();
  await expect(page.getByTestId("setup-screen")).toBeVisible();
  await expect(page.getByLabel("玩家")).toHaveValue("5");
});
