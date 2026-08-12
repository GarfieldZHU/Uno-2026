export type WasmGame = {
  snapshot: () => string;
  play_card: (cardId: number, color: string) => string;
  draw: () => string;
  call_uno: () => string;
  ai_step: () => string;
  restart: (seed: number) => string;
};

type WasmBindings = {
  default: () => Promise<unknown>;
  UnoGame: new (seed: number, profile: string) => WasmGame;
};

export async function createWasmGame(seed: number, profile: string): Promise<WasmGame> {
  const loadBindings = new Function("return import('/wasm/uno_core.js')") as () => Promise<WasmBindings>;
  const bindings = await loadBindings();
  await bindings.default();
  return new bindings.UnoGame(seed, profile);
}
