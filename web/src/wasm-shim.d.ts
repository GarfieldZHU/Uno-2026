declare module "/wasm/uno_core.js" {
  const bindings: {
    default: () => Promise<unknown>;
    UnoGame: new (seed: number, profile: string) => import("./wasm").WasmGame;
  };
  export = bindings;
}
