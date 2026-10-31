# Personal website maintenance

- Preserve the established homepage design. Change only the requested area; keep project slots empty until approved content is provided.
- Public research updates require owner approval. Scheduled briefings and retrospectives never publish or change repositories automatically.
- Edit canonical source paths, not dated/final/backup variants. Git preserves revisions. Daily issue identities and content hashes are legitimate exceptions.
- Resume source and main.pdf are canonical in the dedicated resume repository. Use scripts/sync-resume.mjs; keep portfolio/resume/source.json aligned.
- Run scripts/check-maintenance.mjs and the portfolio checks. Inspect rendered changes, including a narrow viewport, when UI changes.
- Publish using scripts/publish-homepage.mjs after reviewing output. It replaces generated output in a temporary worktree and never force-pushes. Keep Actions disabled.
- Public docs must not contain personal server IPs, private repository paths or credentials. Deployment details belong in private maintenance documentation.
- Only modify repositories assigned by the owner. Never push third-party repositories.
- Update ROADMAP.md with actual completed work and explicit blockers. Do not claim DNS, publication, backup or all-session access without verification.

- Before computer or remote operations, confirm whether the owner wants the home Mac or office Mac, then verify each tool connection. Keep that choice for the task and reconfirm before switching devices.
