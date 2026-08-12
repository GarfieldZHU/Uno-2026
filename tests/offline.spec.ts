import { expect, test } from "@playwright/test";

test("中文主菜单是默认界面，并可切换到英文", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始游戏" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关于" })).toBeVisible();
  await expect(page.getByTestId("main-menu").getByLabel("玩家")).toHaveCount(0);
  await page.screenshot({ path: "test-results/offline-menu-zh.png", fullPage: true });

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "About" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();
  await page.screenshot({ path: "test-results/offline-menu-en.png", fullPage: true });
});

test("设置面板保留3到8席与1到30秒节奏", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByTestId("settings-drawer")).toBeVisible();
  await expect(page.getByLabel("玩家")).toHaveValue("4");
  await expect(page.getByLabel("AI 默认停顿")).toHaveValue("3");

  await page.getByLabel("玩家").selectOption("3");
  await page.getByLabel("AI 默认停顿").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByTestId("settings-drawer")).toBeHidden();
  await page.getByRole("button", { name: "开始游戏" }).click();

  await expect(page.getByText(/牌局 \/ 001 · 3 席/)).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(3);
  await expect(page.locator(".table-scene")).toBeVisible();
  await expect(page.locator(".seat-player")).toHaveCount(3);
  await expect(page.locator(".table-players-rail")).toHaveCount(0);
  await expect(page.locator('img[src="/assets/cards/card-back-v2.svg"]')).toHaveCount(7);
  await expect(page.locator(".hand-fan")).toBeVisible();
  await page.screenshot({ path: "test-results/offline-table-desktop-zh.png", fullPage: true });
});

test("点击弃牌堆可以查看已打出的牌", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await page.getByRole("button", { name: "查看已打出的牌" }).click();
  await expect(page.getByTestId("discard-history")).toBeVisible();
  await expect(page.getByTestId("discard-history").getByText("最新")).toBeVisible();
  await expect(page.getByTestId("discard-history").locator(".history-card")).toHaveCount(1);
  await page.screenshot({ path: "test-results/offline-discard-history-zh.png", fullPage: true });
  await page.locator(".history-close-button").click();
  await expect(page.getByTestId("discard-history")).toBeHidden();
});

test("摸牌会显示对应的短暂动画状态", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByRole("button", { name: "从摸牌堆摸牌" })).toBeEnabled();

  await page.getByRole("button", { name: "从摸牌堆摸牌" }).click();
  await expect(page.locator(".felt-table")).toHaveAttribute("data-animation", "draw");
});

test("牌桌语言切换不会改变牌局，八席窄屏仍可读", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("玩家").selectOption("8");
  await page.getByLabel("AI 默认停顿").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText(/牌局 \/ 001 · 8 席/)).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(8);

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByText("Make your move.")).toBeVisible();
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("你的手牌")).toBeVisible();
  await page.screenshot({ path: "test-results/offline-table-eight-seat-mobile-zh.png", fullPage: true });
});
