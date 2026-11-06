import type { JobRequirement } from "./types";
/** Lista wymagań ogłoszenia dla kandydata: do każdego trzeba dopisać własny przykład. */
export function JobRequirements({
  requirements,
  compact = false,
}: {
  requirements?: JobRequirement[];
  compact?: boolean;
}) {
  if (!requirements?.length) return null;
  return (
    <section className="job-requirements" data-compact={compact || undefined}>
      <h3>Wymagania: do każdego dopisz swój przykład</h3>
      <ol>
        {requirements.map((r) => (
          <li key={r.id}>{r.text}</li>
        ))}
      </ol>
    </section>
  );
}
