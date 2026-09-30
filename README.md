# Tao · AI Infra Notes

Personal research notebook and AI Infra daily archive, published as a static GitHub Pages site.

## Routes

- `/`: interactive knowledge map and research notes
- `/notes/<slug>/`: full native articles
- `/daily/`: all existing daily reports, date archives, topic filters and browser-local bookmarks
- `/research/`: compatible knowledge-map entry
- `/experiments/`: clearly labeled experiment proposals
- `/diagrams/`: SVG figures and editable draw.io sources

## Local development and checks

Use Node.js 24 and pnpm 11.19.0.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

The build downloads and validates the already-public Drive content feed, then exports static HTML for every article to `out/`. It verifies all internal route and asset links. Preview `out/` with any static HTTP server, for example `python3 -m http.server 4173 --directory out`.

No runtime server, database, API key, third-party account token or Cloudflare service is required. GitHub Actions uses only GitHub's standard short-lived deployment credentials.

## GitHub Pages setup

1. Use a public repository named `ttaohe.github.io`, with default branch `main`.
2. In Settings → Pages, set Source to **GitHub Actions**.
3. Push this project to `main`, or run **Deploy AI Infra Notes to GitHub Pages** from Actions.
4. Wait for both `build` and `deploy` to succeed, then verify https://ttaohe.github.io/ and a direct article URL.

The project intentionally has no subdirectory base path: it is configured for the personal site at the root of `ttaohe.github.io`. Do not deploy it under a different repository path without adjusting all route and public-asset URLs.

The workflow rebuilds on pushes, manual dispatch, and every four hours (at minute 23 UTC). GitHub scheduled jobs can be delayed and are not an exact-time delivery guarantee. The workflow must exist on the default branch; GitHub may disable scheduled workflows in inactive public repositories, so check Actions if refreshes stop.

## Public content and fallback behavior

`lib/blog/feed-config.json` points to the existing public Drive JSON feed. `scripts/sync-content.mjs` fetches it before building and validates article structure, HTTPS sources, unique slugs, outline/section alignment, related articles, size and update timestamp. A response that omits an article in the bundled fallback is rejected, so published fallback routes cannot silently disappear.

If the feed cannot be fetched or validated, the build retains `lib/blog/content.json`. Every page then displays an explicit amber notice that the saved snapshot may be stale. A successful subsequent build removes the notice. The rendered content is fixed until the next build, unlike the prior runtime-fetching site.

When publishing content changes, keep the repository's `lib/blog/content.json` fallback current as well. A scheduled build reads the latest feed but does not commit changes back to the repository. Thus a failed later fetch falls back to the most recently committed snapshot. `lib/blog/feed-status.json` records whether the build used the live feed and the content timestamp.

Daily report records remain in `app/daily/page.tsx`. Updating Drive articles alone does not add a daily report; update that file to publish a new daily issue. Preserve all historical records and date/column/bookmark flows.

## Writing and diagrams

Each article starts with a clear question outline, followed by matching sections, evidence, takeaways and open questions. Distinguish reading notes, source-code analysis, design hypotheses and actually executed experiments. Never describe a cited paper's benchmark or an untested idea as a personal reproduction.

Existing figure names are `state-boundary`, `pd-critical-path` and `direct-linker`. Keep each SVG and its editable `.drawio` source together. Remote figures must use publicly readable HTTPS links. All content here and in the configured feed is public; never add credentials, private conversations or unrelated personal data.

## What was migrated

This static project preserves the public AI Infra blog, all three original full articles, the interactive SVG knowledge map, experiment proposals, daily history and diagram downloads. It is separate from the existing `ttaoai-homepage` project and does not use the `infra-daily` repository.
