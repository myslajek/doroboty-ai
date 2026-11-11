import { assistantMode, useAssistantAlive } from "./client";
/** Pasek stanu asystenta: watcher włączany ręcznie (`npm run assistant`) albo tryb symulowany. */
export function AssistantStatus() {
  const alive = useAssistantAlive();
  if (assistantMode === "simulated")
    return (
      <p className="record-caption" role="status" data-assistant="simulated">
        Wersja demonstracyjna: asystent odtwarza zapisane odpowiedzi modelu. Dla nowego tekstu
        pokazuje najbliższy zapisany przykład, a nie ocenę tego tekstu.
      </p>
    );
  return (
    <p className="record-caption" role="status" data-assistant={alive ? "on" : "off"}>
      {alive === null
        ? "Sprawdzam asystenta…"
        : alive
          ? "Asystent włączony: ocenia pytania i odpowiedzi na bieżąco."
          : "Asystent wyłączony. Uruchom w terminalu: npm run assistant. Żądania czekają w kolejce."}
    </p>
  );
}
