export type WasmGame = {
  snapshot: () => string;
  play_card: (cardId: number, color: string) => string;
  draw: () => string;
  call_uno: () => string;
  challenge_uno: () => string;
  ai_step: () => string;
  restart: (seed: number) => string;
};

type WasmBindings = {
  default: () => Promise<unknown>;
  UnoGame: {
    new (seed: number, profile: string): WasmGame;
    new_with_config?: (seed: number, profile: string, playerCount: number) => WasmGame;
  };
};

export async function createWasmGame(seed: number, profile: string, playerCount = 4): Promise<WasmGame> {
  const loadBindings = new Function("return import('/wasm/uno_core.js')") as () => Promise<WasmBindings>;
  const bindings = await loadBindings();
  await bindings.default();
  return bindings.UnoGame.new_with_config
    ? bindings.UnoGame.new_with_config(seed, profile, playerCount)
    : new bindings.UnoGame(seed, profile);
}
