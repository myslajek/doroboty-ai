import { useAssistantAlive } from "./client";
/** Pasek stanu asystenta: watcher włączany ręcznie (`npm run assistant`). */
export function AssistantStatus() {
  const alive = useAssistantAlive();
  return (
    <p className="record-caption" role="status" data-assistant={alive ? "on" : "off"}>
      {alive === null
        ? "Sprawdzam asystenta…"
        : alive
          ? "Asystent włączony: ocenia wymagania i odpowiedzi na bieżąco."
          : "Asystent wyłączony. Uruchom w terminalu: npm run assistant. Żądania czekają w kolejce."}
    </p>
  );
}
