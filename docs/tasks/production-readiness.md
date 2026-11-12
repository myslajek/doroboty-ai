# Production readiness repairs (Vercel)

## Intent

First `/production-readiness` audit (2026-11-11, commit c42c017) left the preparation stage at 9 of 18. The owner chose Vercel as static hosting, evaluators of the prototype as the audience, GitHub issues as the reporting channel, and approved this repair package. No product features are added.

## Changes

- `src/features/prototype/error-boundary.tsx`, `src/main.tsx`: an unforeseen render error shows a recovery screen (reload, report link) instead of a blank page. Nothing is sent anywhere.
- `src/lib/support.ts`, footer in `shell.tsx`, privacy page in `settings.tsx`: one reporting channel, the repository issues.
- `assistant/vite-plugin.mjs`: the assistant bridge is attached to the dev server only. `npm start` / `npm run preview` no longer accept `/__assistant/*` writes; a `VITE_ASSISTANT_MODE=live` build therefore only works behind `npm run dev`.
- `vercel.json`, `package.json` engines `24.x`: explicit static build on the Node major used by CI and local checks.
- `docs/RELEASE.md`: release procedure, post-release check, rollback and outage steps. `scripts/smoke-deployed.mjs` (`npm run smoke -- URL`) runs the post-release check.
- `.prettierignore`: the generated `docs/production-readiness.html` is not formatted.
- Three e2e tests: recovery screen, reporting channel, preview without bridge.

## Verification

Actual results are recorded as evidence in `docs/production-readiness.html`. Deployment itself, the production smoke test and alerts are verified in the second run with the production URL.
