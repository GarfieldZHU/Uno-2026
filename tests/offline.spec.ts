import { expect, test, type Page } from "@playwright/test";

async function playFirstAvailableHumanCard(page: Page) {
  const card = page.locator('.hand-fan .card-art:not(:disabled):not([data-card-asset*="/wild"])').first();
  if (!(await card.isVisible().catch(() => false))) {
    const drawButton = page.getByRole("button", { name: "从摸牌堆摸牌" });
    await expect(drawButton).toBeEnabled({ timeout: 5_000 });
    await drawButton.click();
    await expect(card).toBeVisible({ timeout: 5_000 });
  }
  await card.click();
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button").first().click();
  }
}

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
  await expect(page.locator('img[src="/assets/cards/reference/card-back.svg"]')).toHaveCount(7);
  await expect(page.locator('.hand-fan .card-art img').first()).toHaveAttribute('src', /\/assets\/cards\/reference\//);
  await expect.poll(async () => page.locator('.hand-fan .card-art img').first().evaluate((image) => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight }))).toMatchObject({ complete: true });
  await expect.poll(async () => page.locator('.hand-fan .card-art img').first().evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(async () => page.locator('img[src*="/assets/cards/reference/"]').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(page.locator(".hand-fan")).toBeVisible();
  await expect(page.getByRole("button", { name: "显示顶部信息栏" })).toBeVisible();
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

  await page.getByRole("button", { name: "显示顶部信息栏" }).click();
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByText("Make your move.")).toBeVisible();
  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("你的手牌")).toBeVisible();
  await page.screenshot({ path: "test-results/offline-table-eight-seat-mobile-zh.png", fullPage: true });
});

test("人类出牌会从手牌飞向弃牌堆", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await playFirstAvailableHumanCard(page);
  const flight = page.getByTestId("play-flight");
  await expect(flight).toBeAttached();
  await expect(flight).toHaveAttribute("data-source", "human");
  await expect(flight).toHaveAttribute("data-player-id", "0");
  await expect(flight.locator(".play-flight-trail")).toBeAttached();
  await expect(flight.locator(".play-flight-ripple")).toBeAttached();
  await page.screenshot({ path: "test-results/offline-human-play-flight.png", fullPage: true });
});

test("AI 出牌会先展示牌背再翻到牌面", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("AI 默认停顿").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await playFirstAvailableHumanCard(page);
  const flight = page.locator('.play-flight.is-opponent');
  await expect(flight).toBeAttached({ timeout: 7_000 });
  await expect(flight).toHaveAttribute("data-source", /north|east|west/);
  await expect(flight.locator(".play-flight-back")).toBeAttached();
  await expect(flight.locator(".play-flight-front")).toBeAttached();
  await expect(flight.locator(".play-flight-card")).toHaveCSS("animation-name", "card-flight");
  await page.screenshot({ path: "test-results/offline-ai-play-flight.png", fullPage: true });
});

test("减弱动效偏好保留出牌状态但缩短飞行动画", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await playFirstAvailableHumanCard(page);
  const flightCard = page.getByTestId("play-flight").locator(".play-flight-card");
  await expect(flightCard).toBeAttached();
  await expect.poll(async () => page.getByTestId("play-flight").count()).toBe(1);
  const animationDurationSeconds = await flightCard.evaluate((element) => {
    const value = getComputedStyle(element).animationDuration;
    return value.endsWith("ms") ? Number.parseFloat(value) / 1_000 : Number.parseFloat(value);
  });
  expect(animationDurationSeconds).toBeLessThan(0.001);
});

test("手牌可以拖到牌桌出牌", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
  const card = page.locator(".hand-fan .card-art:not(:disabled)").first();
  await expect(card).toBeVisible();
  await card.dragTo(page.locator('[data-drop-target="table"]'));
  await expect(page.getByTestId("play-flight")).toBeAttached();
  await expect(page.locator('[data-drop-target="table"]')).not.toHaveClass(/is-card-drop-target/);
});

test("万能牌选色显示在牌面上方", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
  const wild = page.locator('.hand-fan .card-art[data-card-asset*="/wild.svg"]:not(:disabled)').first();
  if (await wild.count()) {
    await wild.click();
    await expect(page.locator(".wild-picker")).toBeVisible();
    await expect(page.locator(".modal-scrim")).toHaveCount(0);
  }
});

test("移动端牌桌保留人类出牌飞行层", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByText("轮到你出牌。")).toBeVisible();

  await playFirstAvailableHumanCard(page);
  const flightCard = page.getByTestId("play-flight").locator(".play-flight-card");
  await expect(flightCard).toBeAttached();
  await page.waitForTimeout(230);
  const bounds = await flightCard.evaluate((element) => {
    const card = element.getBoundingClientRect();
    const table = element.closest(".table-scene")?.getBoundingClientRect();
    if (!table) return { visible: false, contained: false };
    const visible = card.width > 0 && card.height > 0;
    const contained = card.left < table.right && card.right > table.left && card.top < table.bottom && card.bottom > table.top;
    return { visible, contained };
  });
  expect(bounds.visible).toBe(true);
  expect(bounds.contained).toBe(true);
  await page.screenshot({ path: "test-results/offline-human-play-flight-mobile.png", fullPage: true });
});
