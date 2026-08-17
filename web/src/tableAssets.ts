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
  "/assets/uno-felt-texture.jpg",
  "/assets/uno-menu-hero-v2.jpg",
  "/assets/uno-table-oval-v2.jpg",
] as const;

export type AssetProgress = { loaded: number; total: number };

function loadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // `load` means the resource is available to paint. Do not gate the
      // loading screen on `decode()`: Chromium can leave decode pending for
      // large PNGs or SVG crops while the image is otherwise renderable,
      // which would strand users on a nearly-complete progress counter.
      // The browser decodes on first paint and the CSS keeps the table hidden
      // until this bounded network preload completes.
      resolve();
    };
    image.onerror = () => reject(new Error(`Unable to load table asset: ${url}`));
    image.src = url;
  });
}

export async function preloadTableAssets(onProgress?: (progress: AssetProgress) => void) {
  let loaded = 0;
  const total = TABLE_ASSET_URLS.length;
  onProgress?.({ loaded, total });
  // Keep the browser's connection/decode queue bounded. A cold Vercel edge
  // can otherwise receive 63 simultaneous image requests and make the
  // loading screen appear stuck even though every file is small or cached.
  const queue = [...TABLE_ASSET_URLS];
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const url = queue[cursor];
      cursor += 1;
      await loadImage(url);
      loaded += 1;
      onProgress?.({ loaded, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, total) }, () => worker()));
}
