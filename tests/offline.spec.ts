import { expect, test, type Page } from "@playwright/test";

async function playFirstAvailableHumanCard(page: Page) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await expect(page.locator(".table-scene-badge")).toContainText("你的回合", { timeout: 8_000 });
    const legal = page.locator('.hand-fan .card-art.is-playable:not(:disabled)');
    if (await legal.count()) {
      const nonWild = page.locator('.hand-fan .card-art.is-playable:not(:disabled):not([data-card-asset*="/wild"])');
      await (await nonWild.count() ? nonWild.first() : legal.first()).dblclick();
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button").first().click();
      return;
    }
    const drawButton = page.getByRole("button", { name: "从摸牌堆摸牌" });
    if (!(await drawButton.isEnabled().catch(() => false))) {
      await page.waitForTimeout(120);
      continue;
    }
    await drawButton.click();
    await page.waitForTimeout(80);
  }
  throw new Error("no legal human card became available");
}

async function waitForInitialDeal(page: Page) {
  await expect(page.locator(".table-scene")).toHaveAttribute("data-deal-phase", "ready", { timeout: 10_000 });
}

test("中文主菜单是默认界面，并可切换到英文", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("main-menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始游戏" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关于" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "开始一局 UNO" })).toBeVisible();
  await expect(page.locator(".menu-home-link")).toHaveAttribute("href", "https://alohayo.me/");
  await expect(page.locator(".menu-home-link")).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("main-menu").getByLabel("玩家")).toHaveCount(0);
  await page.screenshot({ path: "test-results/offline-menu-zh.png", fullPage: true });

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "About" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();
  await page.screenshot({ path: "test-results/offline-menu-en.png", fullPage: true });
});

test("局内记录可以查看、回放并导出", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);

  await page.getByTestId("game-record-toggle").click();
  await expect(page.getByTestId("game-record-panel")).toBeVisible();
  await expect(page.getByTestId("game-record-panel").locator(".game-record-event")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByTestId("game-record-export").click();
  expect((await download).suggestedFilename()).toMatch(/^uno-2026-offline-record-.*\.json$/);
  await page.getByTestId("game-record-replay").click();
  await expect(page.getByTestId("game-record-panel")).toContainText("回放中");
});

test("开始牌局会先等待所有牌桌资源加载完成", async ({ page }) => {
  await page.goto("/");
  await page.route("**/assets/cards/reference/*.svg", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("asset-loading")).toBeVisible();
  await expect(page.getByTestId("asset-loading")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".table-scene")).toBeVisible();
  await waitForInitialDeal(page);
  await expect.poll(async () => page.locator(".table-scene img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
});

test("设置面板保留3到10席与1到30秒节奏", async ({ page }) => {
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
  await waitForInitialDeal(page);

  await expect(page.getByText(/牌局 \/ 001 · 3 席/)).toBeVisible();
  await expect(page.locator(".player-row")).toHaveCount(3);
  await expect(page.locator(".table-scene")).toBeVisible();
  await expect(page.locator(".seat-player")).toHaveCount(3);
  await expect(page.locator(".table-players-rail")).toHaveCount(0);
  await expect(page.locator(".seat-card-fan img")).toHaveCount(14);
  await expect(page.locator('img[src="/assets/cards/reference/card-back.svg"]')).toHaveCount(15);
  await expect(page.locator('.hand-fan .card-art img').first()).toHaveAttribute('src', /\/assets\/cards\/reference\//);
  await expect(page.locator('.hand-fan .card-art img').first()).toHaveCSS('object-fit', 'fill');
  await expect(page.locator('.hand-fan .card-art').first()).toHaveCSS('overflow', 'visible');
  await expect(page.locator('.discard-stack .card-art img')).toHaveCSS('border-radius', '0px');
  await expect.poll(async () => page.locator('.discard-stack .card-art').evaluate((card) => getComputedStyle(card, '::after').borderTopWidth)).toBe('0px');
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
  await waitForInitialDeal(page);
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
  await waitForInitialDeal(page);
  await expect(page.getByRole("button", { name: "从摸牌堆摸牌" })).toBeEnabled();

  await page.getByRole("button", { name: "从摸牌堆摸牌" }).click();
  await expect(page.locator(".felt-table")).toHaveAttribute("data-animation", "draw");
  await expect(page.getByTestId("draw-card-flight")).toBeAttached();
  await expect(page.getByTestId("draw-card-flight").locator(".draw-card-flight-back")).toBeAttached();
  await expect(page.getByTestId("draw-card-flight").locator(".draw-card-flight-front")).toBeAttached();
  await expect(page.locator(".hand-card.is-drawn-highlight")).toHaveCount(1);
});

test("初始发牌结束后会短暂标示起始玩家", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("initial-deal")).toBeVisible();
  await expect(page.getByTestId("initial-deal")).toHaveAttribute("data-phase", "dealing");
  await expect(page.getByTestId("deal-human-progress")).toBeVisible();
  await expect(page.locator(".deal-sequence-card")).toHaveCount(28);
  await expect(page.getByTestId("initial-deal")).toHaveAttribute("data-human-count", "7", { timeout: 7_000 });
  await page.screenshot({ path: "test-results/offline-initial-deal-geometry.png", fullPage: true });
  await expect(page.getByTestId("initial-deal")).toBeHidden({ timeout: 8_000 });
  await expect(page.getByTestId("starting-player-callout")).toBeHidden();
  await expect(page.getByTestId("table-direction-indicator")).toBeVisible();
  await expect(page.getByTestId("table-direction-indicator")).toHaveAttribute("data-direction", "clockwise");
  await expect(page.getByTestId("table-direction-indicator")).toContainText("顺时针");
  await expect(page.locator(".direction-arrow-route.is-active-route")).toHaveCount(1);
  await expect(page.getByTestId("table-direction-indicator")).toHaveAttribute("data-active-route", /\d+-\d+/);
  await expect(page.locator(".table-direction-arrows .direction-arrow-line")).toHaveCount(4);
  await expect(page.locator('.table-direction-arrows .direction-arrow-line[data-arrow-position="midpoint"][marker-mid]')).toHaveCount(4);
  await expect(page.locator(".table-center .table-direction-chip")).toHaveCount(0);
});

test("五到十席按实际座位环生成对应方向箭头", async ({ page }) => {
  test.setTimeout(80_000);
  for (const playerCount of [5, 6, 7, 8, 9, 10]) {
    await page.goto("/");
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByLabel("玩家").selectOption(String(playerCount));
    await page.getByLabel("AI 默认停顿").fill("1");
    await page.getByRole("button", { name: "保存设置" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await waitForInitialDeal(page);

    const seats = page.locator(`.table-seats[data-player-count="${playerCount}"] .seat-player`);
    await expect(seats).toHaveCount(playerCount);
    await expect(page.locator(".direction-arrow-route")).toHaveCount(playerCount);
    await expect(page.locator(".direction-arrow-line")).toHaveCount(playerCount);
    await expect(page.locator('.direction-arrow-line[data-arrow-position="midpoint"][marker-mid]')).toHaveCount(playerCount);
    await expect(page.locator(".direction-arrow-route.is-active-route")).toHaveCount(1);
    const playerIds = await seats.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-player-id")));
    expect(new Set(playerIds).size).toBe(playerCount);
  }
});

test("牌桌显示出牌方向并支持一键整理手牌", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);
  await expect(page.getByTestId("direction-indicator")).toHaveAttribute("data-direction", "clockwise");
  await expect(page.getByTestId("direction-indicator")).toHaveAttribute("aria-label", "顺时针出牌");
  await expect(page.getByTestId("table-direction-indicator")).toHaveAttribute("data-direction", "clockwise");
  await expect(page.getByTestId("table-direction-indicator")).toContainText("顺时针");
  await expect(page.getByText("保持节奏。")).toHaveCount(0);
  await expect(page.locator('.seat-player.is-next .seat-next-label')).toHaveCount(1);
  await expect(page.locator('.seat-player.is-next .seat-next-label')).toBeVisible();
  const hand = page.getByTestId("hand-rail");
  const before = await hand.locator("[data-card-id]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-card-id")));
  await page.getByTestId("sort-hand").click();
  const after = await hand.locator("[data-card-id]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-card-id")));
  expect(after).toHaveLength(before.length);
  expect(new Set(after)).toEqual(new Set(before));
  await page.screenshot({ path: "test-results/offline-hand-sort-direction.png", fullPage: true });
});

test("当前玩家高亮和出牌特效节点随回合存在", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);
  await expect(page.locator('.seat-player.is-active')).toHaveCount(1);
  await expect(page.locator('.seat-player.is-active .seat-turn-pip')).toBeVisible();
  await expect(page.locator('.seat-player.is-active .seat-turn-label')).toBeVisible();
  await expect(page.locator('.seat-player.is-next .seat-next-marker')).toBeVisible();
  await expect(page.getByTestId("direction-indicator")).toBeVisible();
});

test("牌桌语言切换不会改变牌局，八席窄屏仍可读", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("玩家").selectOption("8");
  await page.getByLabel("AI 默认停顿").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);
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
  await waitForInitialDeal(page);
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
  await waitForInitialDeal(page);
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
  await waitForInitialDeal(page);
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
  await waitForInitialDeal(page);
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
  await expect(page.locator(".table-scene-badge")).toContainText("你的回合", { timeout: 8_000 });
  const card = page.locator(".hand-fan .card-art.is-playable:not(:disabled)").first();
  await expect(card).toBeVisible();
  await card.dragTo(page.locator('[data-drop-target="table"]'));
  const picker = page.getByRole("dialog");
  if (await picker.isVisible().catch(() => false)) await picker.getByRole("button").first().click();
  await expect(page.getByTestId("play-flight")).toBeAttached();
  await expect(page.locator('[data-drop-target="table"]')).not.toHaveClass(/is-card-drop-target/);
});

test("万能牌选色显示在牌面上方", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);
  await expect(page.getByText("轮到你出牌。")).toBeVisible();
  const wild = page.locator('.hand-fan .card-art[data-card-asset*="/wild.svg"]:not(:disabled)').first();
  if (await wild.count()) {
    await wild.click();
    await expect(wild).toHaveClass(/is-lifted/);
    await wild.click();
    await expect(page.locator(".wild-picker")).toBeVisible();
    await expect(page.locator(".modal-scrim")).toHaveCount(0);
  }
});

test("移动端牌桌保留人类出牌飞行层", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);
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

test("离线牌局可以完整轮转并显示结算", async ({ page }) => {
  test.setTimeout(60_000);
  // Keep the same player-facing flow while shortening only the configured AI
  // pauses so a deterministic browser smoke test can reach a terminal table.
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      nativeSetTimeout(handler, Math.min(timeout ?? 0, 8), ...args)) as typeof window.setTimeout;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("玩家").selectOption("3");
  await page.getByLabel("AI 默认停顿").fill("1");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await waitForInitialDeal(page);
  await expect(page.getByText(/牌局 \/ 001 · 3 席/)).toBeVisible();

  for (let step = 0; step < 900; step += 1) {
    if (await page.locator(".table-scene-badge").filter({ hasText: "牌局结束" }).isVisible().catch(() => false)) break;
    const openPicker = page.locator(".wild-picker");
    if (await openPicker.isVisible().catch(() => false)) {
      await openPicker.locator(".wild-picker-option").first().evaluate((element) => (element as HTMLButtonElement).click());
      await page.waitForTimeout(12);
      continue;
    }
    const badge = await page.locator(".table-scene-badge").textContent().catch(() => "");
    if (badge?.includes("你的回合")) {
      const playable = page.locator('.hand-fan .card-art.is-playable:not(:disabled)').first();
      if (await playable.isVisible().catch(() => false)) {
        await playable.dblclick({ force: true });
      } else {
        await page.getByRole("button", { name: "从摸牌堆摸牌" }).click({ force: true });
      }
    } else {
      await page.waitForTimeout(12);
    }
  }

  await expect(page.locator(".table-scene-badge")).toHaveText("牌局结束", { timeout: 5_000 });
  await expect(page.getByTestId("settlement-overlay")).toBeVisible();
  await expect(page.getByTestId("settlement-overlay")).toHaveAttribute("data-result", /win|lose/);
  await expect(page.locator(".status-code")).toContainText("player-");
  await expect(page.getByRole("button", { name: "从摸牌堆摸牌" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "再来一局" })).toBeVisible();
  await expect(page.getByTestId("table-exit")).toBeVisible();
  await page.screenshot({ path: "test-results/offline-settlement-zh.png", fullPage: true });
});
