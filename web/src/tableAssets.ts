const COLORS = ["red", "yellow", "green", "blue"] as const;
const COLORED_CARD_ASSETS = ["zero", "1", "2", "3", "4", "5", "6", "7", "8", "9", "draw-two", "reverse"] as const;

/** All images that can appear on the menu, table, hand rail, or card flight. */
export const TABLE_ASSET_URLS = [
  ...COLORS.flatMap((color) => COLORED_CARD_ASSETS.map((asset) => `/assets/cards/reference/${color}-${asset}.svg`)),
  ...COLORS.map((color) => `/assets/cards/reference/${color}-0.svg`),
  "/assets/cards/reference/card-back.svg",
  "/assets/cards/reference/wild.svg",
  "/assets/cards/reference/wild-draw-four.svg",
  "/assets/cards/card-back-v2.svg",
  "/assets/cards/card-symbols.svg",
  "/assets/cards/sparkle.svg",
  "/assets/cards/uno-title.svg",
  "/assets/uno-avatar-sheet-v2.png",
  "/assets/uno-felt-texture.png",
  "/assets/uno-menu-hero-v2.png",
  "/assets/uno-table-oval-v2.png",
] as const;

export type AssetProgress = { loaded: number; total: number };

function loadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Reference card SVGs crop one shared 2.2 MB sprite sheet through an
      // <image> node. Waiting for decode() on every crop serializes the same
      // bitmap dozens of times on Chromium (especially on a cold CDN edge),
      // leaving the loading screen stuck even though the network resources
      // are complete. `load` is the correct readiness boundary for SVG: the
      // browser has the document and can paint it from the cached sprite.
      if (url.endsWith(".svg")) {
        resolve();
        return;
      }
      if (image.decode) {
        void image.decode().catch(() => undefined).then(() => resolve());
      } else {
        resolve();
      }
    };
    image.onerror = () => reject(new Error(`Unable to load table asset: ${url}`));
    image.src = url;
  });
}

export async function preloadTableAssets(onProgress?: (progress: AssetProgress) => void) {
  let loaded = 0;
  const total = TABLE_ASSET_URLS.length;
  onProgress?.({ loaded, total });
  await Promise.all(TABLE_ASSET_URLS.map(async (url) => {
    await loadImage(url);
    loaded += 1;
    onProgress?.({ loaded, total });
  }));
}
