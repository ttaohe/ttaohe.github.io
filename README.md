# Tao · AI Infra Daily Notes

A public portfolio section at **https://ttaohe.github.io/ai-infra-daily-notes/**, mirrored from the same public Drive content source as the original blog. The personal homepage at `/` stays available for other projects.

## Published routes

- `/`: minimal personal portfolio landing page
- `/ai-infra-daily-notes/`: interactive knowledge map and research notes
- `/ai-infra-daily-notes/notes/<slug>/`: complete native articles
- `/ai-infra-daily-notes/daily/`: current reports, all historical issues, topic filters and browser-local bookmarks
- `/ai-infra-daily-notes/research/`: knowledge-map compatibility entry
- `/ai-infra-daily-notes/experiments/`: clearly labeled experiment proposals
- `/ai-infra-daily-notes/diagrams/`: SVG figures and editable draw.io sources

The first root-level article, Daily, research and experiment URLs keep small redirect pages so previously shared links remain useful.

## Local development and checks

Use Node.js 24 and pnpm 11.19.0.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

The build validates the public Drive feed, exports Next.js static HTML into `out/`, then prepares the portfolio layout in `publish/`. The app export is placed under `publish/ai-infra-daily-notes/`; the root landing page is `portfolio/index.html`. All internal route and asset URLs are checked with the configured prefix. Preview `publish/` with a static HTTP server, for example `python3 -m http.server 4173 --directory publish`.

`lib/site-config.json` is the single prefix/origin configuration. `sitePath()` prefixes app-local links and assets while keeping external sources and fragments unchanged.

No runtime server, database, private API key or Cloudflare service is required for GitHub Pages. GitHub Actions uses standard short-lived deployment credentials; external actions are pinned to verified commit SHAs.

## GitHub Pages setup

Repository: `ttaohe/ttaohe.github.io`, default branch: `main`. Settings → Pages → Source must be **GitHub Actions**. The workflow uploads only `publish/`.

Builds run after a push, on manual dispatch, and at a fallback four-hour cadence (minute 23 UTC). Scheduled GitHub jobs can be delayed and are not an exact-time delivery guarantee. GitHub can disable schedules for inactive public repositories, so inspect Actions if refreshes stop.

## One authoritative content source

`lib/blog/feed-config.json` identifies the existing public Drive JSON file. Its backward-compatible schema contains:

- `schemaVersion`, `updatedAt`, `posts`: full research articles
- optional `daily`: year, issue metadata, reports, archive dates, columns and signal distribution
- optional `experiments`: hypotheses, methods, metrics, falsifiers and related articles

Drive is the authoritative material/content store. This repository contains the deployable source mirror and a verified fallback snapshot. Both published sites consume the common content rather than maintaining separate Daily or experiment records. Source archives and original materials are maintained in Drive.

The approved content-maintenance task should update Drive first, verify it, and mirror the exact validated payload into `lib/blog/content.json` on `main`. That push starts an immediate rebuild. The scheduled rebuild is a fallback for changes that have not yet triggered a commit. A scheduled build reads the current feed but does not itself commit back to the repository.

A completed build is required for new content to appear on GitHub Pages. The other site's runtime cache and this build pipeline can briefly show different revisions during refresh. Confirm the content timestamp and live pages after publishing rather than claiming instantaneous synchronization.

## Safe fallback

`scripts/sync-content.mjs` reads raw public JSON and validates article structure, HTTPS source URLs, unique identifiers, related-article references, Daily dates/columns, response size and content timestamp. It rejects feeds that silently omit previously committed articles, Daily items or experiments.

If fetching/validation fails, it retains `lib/blog/content.json` and renders an explicit amber stale-data notice on every app page. Legacy post-only feeds remain accepted: missing Daily/experiment sections use the saved data and enable the same notice. A successful complete refresh removes it. The personal landing page contains no content claims and does not depend on the feed.

Keep the committed fallback current when publishing changes. Otherwise a later fetch failure will use the last committed snapshot. `lib/blog/feed-status.json` records the build's source status and content timestamp. `daily-snapshot.json` and `experiments.ts` preserve backward-compatible local defaults; all normal rendering consumes the common content payload.

## Writing and diagrams

Start articles with a clear question outline, followed by matching sections, evidence, takeaways and open questions. Distinguish reading notes, source analysis, design hypotheses and actually executed experiments. Never describe a cited benchmark or untested idea as a personal reproduction.

Keep each SVG figure with its editable `.drawio` source. Built-in figures are `state-boundary`, `pd-critical-path` and `direct-linker`; new remote figures require publicly readable HTTPS links. All deployed material is public. Never include credentials, private conversations or unrelated personal data.

This project is separate from `ttaoai-homepage` and does not use the `infra-daily` repository.
