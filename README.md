> 当前发布方式（2026-10-31）：手动生成静态网页并推送到 `gh-pages` 分支，仓库 Actions 保持关闭。正文与历史日报的 Markdown、图源、简历源文件保存在私有 `ttaohe/notes` 仓库；日报经用户逐期同意后才发布。操作见 [手动发布说明](docs/MANUAL-PUBLISHING.md)。下方早期架构说明保留作历史参考，涉及自动工作流的描述不代表当前配置。

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
