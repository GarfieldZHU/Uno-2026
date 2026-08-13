import { expect, test, type Page } from "@playwright/test";

async function playIfItIsThisClientTurn(page: Page) {
  const table = page.locator(".online-table-shell");
  if (!(await table.isVisible().catch(() => false))) return false;
  const badge = await table.locator(".table-scene-badge").textContent().catch(() => "");
  if (!badge?.includes("你的回合")) return false;

  const playable = table.locator('.hand-fan .card-art:not(:disabled)').first();
  if (await playable.isVisible().catch(() => false)) {
    await playable.evaluate((element) => (element as HTMLButtonElement).click());
    const picker = table.locator(".wild-picker");
    if (await picker.isVisible().catch(() => false)) {
      await picker.locator(".wild-picker-option").first().evaluate((element) => (element as HTMLButtonElement).click());
    }
  } else {
    const draw = table.getByRole("button", { name: "从摸牌堆摸牌" });
    if (!(await draw.isEnabled().catch(() => false))) return false;
    await draw.click({ force: true });
  }
  return true;
}

test("三个浏览器窗口可加入六席房间并与三个 AI 完成联机牌局", async ({ browser }) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext();
  const guestOneContext = await browser.newContext();
  const guestTwoContext = await browser.newContext();
  const pages = await Promise.all([hostContext.newPage(), guestOneContext.newPage(), guestTwoContext.newPage()]);

  try {
    const [host, guestOne, guestTwo] = pages;
    await host.goto("/");
    await host.getByRole("button", { name: "联机" }).click();
    await host.getByLabel("你的昵称").fill("Host");
    await host.getByLabel("总席位").fill("6");
    await host.getByLabel("AI 数量").fill("3");
    await host.locator('.online-range-field input[type="range"]').fill("5");
    await host.getByRole("button", { name: "创建房间" }).click();
    await expect(host.getByTestId("online-room")).toBeVisible();
    const roomCode = await host.getByTestId("online-room").locator("code").innerText();
    expect(roomCode).toMatch(/^[A-Z2-9]{4}$/);
    await expect(host.getByTestId("online-room").getByText("4/6 · 5 秒")).toBeVisible();

    for (const [page, name] of [[guestOne, "Guest 1"], [guestTwo, "Guest 2"]] as const) {
      await page.goto("/");
      await page.getByRole("button", { name: "联机" }).click();
      await page.getByLabel("你的昵称").fill(name);
      await page.getByLabel("房间码").fill(roomCode);
      await page.getByRole("button", { name: "加入房间" }).click();
      await expect(page.getByTestId("online-room")).toBeVisible();
      await expect(page.getByTestId("online-room").locator("code")).toHaveText(roomCode);
    }

    await expect(host.getByTestId("online-room").locator(".online-player-list li")).toHaveCount(6);
    await host.getByRole("button", { name: "房主开始" }).click();
    await expect(host.locator(".online-table-shell")).toBeVisible({ timeout: 10_000 });
    await expect(guestOne.locator(".online-table-shell")).toBeVisible({ timeout: 10_000 });
    await expect(guestTwo.locator(".online-table-shell")).toBeVisible({ timeout: 10_000 });

    for (const page of pages) {
      await expect.poll(async () => page.locator('.online-table-shell img[src*="/assets/cards/reference/"]').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
      await expect(page.locator(".online-table-shell .seat-card-fan")).toHaveCount(5);
    }

    let settled = false;
    for (let tick = 0; tick < 1_500 && !settled; tick += 1) {
      for (const page of pages) {
        if (await page.getByText("牌局结束").isVisible().catch(() => false)) {
          settled = true;
          break;
        }
        await playIfItIsThisClientTurn(page);
      }
      if (!settled) await new Promise((resolve) => setTimeout(resolve, 180));
    }

    for (const page of pages) {
      await expect(page.getByText("牌局结束")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(".status-code")).toContainText("player-");
    }
    await host.screenshot({ path: "test-results/online-settlement-three-windows.png", fullPage: true });
  } finally {
    await Promise.all([hostContext.close(), guestOneContext.close(), guestTwoContext.close()]);
  }
});
