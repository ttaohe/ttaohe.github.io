# Personal homepage
This repository deploys https://ttaohe.github.io/ (profile, experience summaries and resume).
Research articles, project details, daily reports and experiments are served by https://8.159.157.10/.
The private notes repository stores the VPS source under services/personal-site.

Pushes to main deploy automatically. A four-hour schedule refreshes public excerpts from the VPS API.
The build fails if the VPS public feed cannot be fetched; it does not silently publish an older feed.
Change publicContentOrigin in lib/site-config.json when the filed domain is ready.
Old section and article URLs redirect to the matching VPS route, preserving query strings and fragments.

Build: pnpm install --frozen-lockfile && pnpm build
Validation: pnpm test && pnpm lint
The final build verifies the homepage assets, PDF resume and redirect targets.

Legacy research source and tests are retained for migration history. They are no longer built or hosted here.
