import { useState } from "react";
import { copy, type Language } from "./i18n";
import { downloadNetworkDiagnostics } from "./networkDiagnostics";

export function NetworkLogExportButton({ language }: { language: Language }) {
  const text = copy(language);
  const [exported, setExported] = useState(false);

  return (
    <button
      className={`network-log-export ${exported ? "is-exported" : ""}`}
      data-testid="network-log-export"
      type="button"
      title={exported ? text.networkLogDone : text.networkLogHint}
      aria-label={exported ? text.networkLogDone : text.networkLog}
      onClick={() => {
        downloadNetworkDiagnostics();
        setExported(true);
        window.setTimeout(() => setExported(false), 2_400);
      }}
    >
      <span aria-hidden="true">{exported ? "✓" : "⌁"}</span>
      <span className="sr-only">{exported ? text.networkLogDone : text.networkLog}</span>
    </button>
  );
}
