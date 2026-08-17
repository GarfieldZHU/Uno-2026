/* tslint:disable */
/* eslint-disable */

/**
 * Browser-facing owner of the same deterministic game state used by native tests.
 */
export class UnoGame {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Advances one AI turn. The UI can call this between small delays to keep the
     * opponent readable and still use exactly the native AI implementation.
     */
    ai_step(): string;
    call_uno(): string;
    /**
     * Challenge the currently open UNO window from the human seat.
     */
    challenge_uno(): string;
    draw(): string;
    constructor(seed: number, profile: string);
    static new_with_config(seed: number, profile: string, player_count: number): UnoGame;
    play_card(card_id: number, chosen_color: string): string;
    restart(seed: number): string;
    snapshot(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_unogame_free: (a: number, b: number) => void;
    readonly unogame_ai_step: (a: number) => [number, number];
    readonly unogame_call_uno: (a: number) => [number, number];
    readonly unogame_challenge_uno: (a: number) => [number, number];
    readonly unogame_draw: (a: number) => [number, number];
    readonly unogame_new: (a: number, b: number, c: number) => number;
    readonly unogame_new_with_config: (a: number, b: number, c: number, d: number) => number;
    readonly unogame_play_card: (a: number, b: number, c: number, d: number) => [number, number];
    readonly unogame_restart: (a: number, b: number) => [number, number];
    readonly unogame_snapshot: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
