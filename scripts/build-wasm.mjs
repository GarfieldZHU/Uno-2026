import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(root, "web/public/wasm");
const generatedModule = resolve(output, "uno_core.js");

mkdirSync(output, { recursive: true });

if (!existsSync(generatedModule) || process.env.UNO_REBUILD_WASM === "1") {
  try {
    execFileSync(
      "wasm-pack",
      ["build", "crates/uno-core", "--target", "web", "--out-dir", "../../web/public/wasm", "--release"],
      { cwd: root, stdio: "inherit" },
    );
  } catch (error) {
    if (!existsSync(generatedModule)) {
      console.error("Unable to build the Rust/WASM module and no committed artifact exists.");
      throw error;
    }
    console.warn("wasm-pack is unavailable; using the committed WASM artifact.");
  }
} else {
  console.log("Using committed web/public/wasm/uno_core.js (set UNO_REBUILD_WASM=1 to rebuild).");
}
