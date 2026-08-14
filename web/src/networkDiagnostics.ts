/**
 * Small, local-only network diagnostics collector for the online table.
 *
 * The report is deliberately a telemetry envelope, not a replay: it keeps
 * timings, transport state and browser network capabilities, while removing
 * room codes, player tokens, card data and request payloads.
 */

export type DiagnosticValue = string | number | boolean | null;

export type NetworkDiagnosticEvent = {
  atMs: number;
  type: string;
  detail: Record<string, DiagnosticValue>;
};

type ConnectionInfo = {
  online: boolean | null;
  effectiveType: string | null;
  type: string | null;
  rttMs: number | null;
  downlinkMbps: number | null;
  saveData: boolean | null;
};

type NetworkContext = {
  pageOrigin: string;
  apiOrigin: string;
  apiPath: string;
  websocketOrigin: string;
  routeMode: "same-origin" | "configured-api";
  protocol: string;
  host: string;
  language: string;
  timezone: string;
  visibility: string;
  viewportWidth: number | null;
  viewportHeight: number | null;
  devicePixelRatio: number | null;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  userAgent: string;
  connection: ConnectionInfo;
  navigation: Record<string, DiagnosticValue>;
};

export type NetworkDiagnosticsReport = {
  schemaVersion: 1;
  generatedAt: string;
  sessionStartedAt: string;
  durationMs: number;
  context: NetworkContext;
  counters: Record<string, number>;
  events: NetworkDiagnosticEvent[];
};

type ConnectionLike = {
  effectiveType?: string;
  type?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: ConnectionLike;
  deviceMemory?: number;
};

const MAX_EVENTS = 600;
const MAX_STRING_LENGTH = 240;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function boundedString(value: string, max = MAX_STRING_LENGTH) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function scalar(value: unknown): DiagnosticValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return boundedString(value);
  return undefined;
}

function safeOrigin(raw: string, fallback = "unknown") {
  try {
    return new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.href).origin;
  } catch {
    return fallback;
  }
}

function safePath(raw: string, fallback = "/") {
  try {
    const pathname = new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.href).pathname;
    return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function sanitizeRoute(path: string) {
  return path
    .replace(/(\/api\/v1\/rooms\/)[^/?#]+/g, "$1:room")
    .replace(/([?&]token=)[^&]+/gi, "$1:REDACTED")
    .replace(/([?&]player_token=)[^&]+/gi, "$1:REDACTED");
}

export function safeWebSocketOrigin(raw: string) {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "unknown";
  }
}

function readConnection(): ConnectionInfo {
  if (typeof navigator === "undefined") {
    return { online: null, effectiveType: null, type: null, rttMs: null, downlinkMbps: null, saveData: null };
  }
  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
    effectiveType: connection?.effectiveType ?? null,
    type: connection?.type ?? null,
    rttMs: typeof connection?.rtt === "number" ? round(connection.rtt) : null,
    downlinkMbps: typeof connection?.downlink === "number" ? round(connection.downlink) : null,
    saveData: typeof connection?.saveData === "boolean" ? connection.saveData : null,
  };
}

function readNavigation(): Record<string, DiagnosticValue> {
  if (typeof performance === "undefined") return {};
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!entry) return {};
  return {
    dnsMs: round(entry.domainLookupEnd - entry.domainLookupStart),
    tcpMs: round(entry.connectEnd - entry.connectStart),
    tlsMs: round(Math.max(0, entry.requestStart - entry.connectEnd)),
    requestMs: round(entry.responseStart - entry.requestStart),
    responseMs: round(entry.responseEnd - entry.responseStart),
    domContentLoadedMs: round(entry.domContentLoadedEventEnd),
    transferSizeBytes: entry.transferSize,
    encodedBodySizeBytes: entry.encodedBodySize,
  } satisfies Record<string, DiagnosticValue>;
}

function readContext(): NetworkContext {
  const configuredApi = typeof import.meta !== "undefined" ? (import.meta.env.VITE_ONLINE_API_URL ?? "") : "";
  const pageOrigin = typeof window === "undefined" ? "unknown" : window.location.origin;
  const apiOrigin = configuredApi ? safeOrigin(configuredApi) : pageOrigin;
  const websocketOrigin = apiOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  const nav = typeof navigator === "undefined" ? undefined : (navigator as NavigatorWithConnection);
  const location = typeof window === "undefined" ? null : window.location;
  return {
    pageOrigin,
    apiOrigin,
    apiPath: configuredApi ? safePath(configuredApi) : "/api",
    websocketOrigin,
    routeMode: configuredApi ? "configured-api" : "same-origin",
    protocol: location?.protocol ?? "unknown",
    host: location?.host ?? "unknown",
    language: typeof navigator === "undefined" ? "unknown" : navigator.language,
    timezone: typeof Intl === "undefined" ? "unknown" : Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown",
    visibility: typeof document === "undefined" ? "unknown" : document.visibilityState,
    viewportWidth: typeof window === "undefined" ? null : window.innerWidth,
    viewportHeight: typeof window === "undefined" ? null : window.innerHeight,
    devicePixelRatio: typeof window === "undefined" ? null : round(window.devicePixelRatio),
    hardwareConcurrency: nav?.hardwareConcurrency ?? null,
    deviceMemoryGb: typeof nav?.deviceMemory === "number" ? nav.deviceMemory : null,
    userAgent: typeof navigator === "undefined" ? "unknown" : boundedString(navigator.userAgent, 360),
    connection: readConnection(),
    navigation: readNavigation(),
  };
}

export class NetworkDiagnostics {
  private readonly startedAt = Date.now();
  private readonly startedAtIso = new Date(this.startedAt).toISOString();
  private readonly context = readContext();
  private readonly events: NetworkDiagnosticEvent[] = [];
  private readonly counters: Record<string, number> = {};
  private readonly cleanups: Array<() => void> = [];

  constructor() {
    if (typeof window !== "undefined") {
      const onOnline = () => this.record("browser.online", { online: true });
      const onOffline = () => this.record("browser.online", { online: false });
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      this.cleanups.push(() => window.removeEventListener("online", onOnline));
      this.cleanups.push(() => window.removeEventListener("offline", onOffline));
    }
    if (typeof document !== "undefined") {
      const onVisibility = () => this.record("browser.visibility", { state: document.visibilityState });
      document.addEventListener("visibilitychange", onVisibility);
      this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    }
    if (typeof navigator !== "undefined") {
      const connection = (navigator as NavigatorWithConnection).connection;
      if (connection?.addEventListener && connection.removeEventListener) {
        const onConnectionChange = () => {
          const current = readConnection();
          this.record("browser.connection-change", { effectiveType: current.effectiveType, rttMs: current.rttMs, downlinkMbps: current.downlinkMbps, saveData: current.saveData });
        };
        connection.addEventListener("change", onConnectionChange);
        this.cleanups.push(() => connection.removeEventListener?.("change", onConnectionChange));
      }
    }
  }

  record(type: string, detail: Record<string, unknown> = {}) {
    const safeDetail: Record<string, DiagnosticValue> = {};
    for (const [key, value] of Object.entries(detail)) {
      const safe = scalar(value);
      if (safe !== undefined) safeDetail[key] = safe;
    }
    this.events.push({ atMs: Math.max(0, Date.now() - this.startedAt), type: boundedString(type, 80), detail: safeDetail });
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    this.counters[type] = (this.counters[type] ?? 0) + 1;
  }

  report(): NetworkDiagnosticsReport {
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sessionStartedAt: this.startedAtIso,
      durationMs: Math.max(0, Date.now() - this.startedAt),
      context: { ...this.context, visibility: typeof document === "undefined" ? this.context.visibility : document.visibilityState, connection: readConnection() },
      counters: { ...this.counters },
      events: this.events.map((event) => ({ ...event, detail: { ...event.detail } })),
    };
  }

  dispose() {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }
}

let activeDiagnostics: NetworkDiagnostics | null = null;

export function getNetworkDiagnostics() {
  activeDiagnostics ??= new NetworkDiagnostics();
  return activeDiagnostics;
}

export function resetNetworkDiagnostics() {
  activeDiagnostics?.dispose();
  activeDiagnostics = new NetworkDiagnostics();
  activeDiagnostics.record("session.start", { route: "online" });
  return activeDiagnostics;
}

export function downloadNetworkDiagnostics() {
  const report = getNetworkDiagnostics().report();
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return report;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `uno-2026-network-${stamp}.json`;
  link.rel = "noopener";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return report;
}
