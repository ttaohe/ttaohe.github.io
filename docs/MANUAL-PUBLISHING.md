# Manual static publication

As of 2026-10-31, GitHub Pages serves prebuilt files from the gh-pages branch. Repository Actions remain disabled. The source stays on main. Branch publishing uses GitHub's built-in Pages build service; it does not run this repository's workflows.

## Reviewed changes

The homepage clock and its runtime script are removed. The project section retains its anchor and an empty visual slot. The PDF resume excludes project experience. The education and employment sections, theme picker, navigation and PDF controls remain.

## Publication

Use Node.js 24. The homepage generator uses only Node standard-library modules:

    node scripts/prepare-publish.mjs
    node scripts/finalize-homepage.mjs
    node --test scripts/portfolio-*.test.mjs

Review publish/index.html and the PDF before publishing. Copy the resulting publish/ files into a checkout of gh-pages, commit and push that branch. Retain .nojekyll. Do not copy main's .github directory, source files, credentials or private drafts to the publication branch. Keep the source change committed to main.

When necessary, request GitHub's built-in branch build with:

    gh api --method POST repos/ttaohe/ttaohe.github.io/pages/builds

Verify Pages reports built, verify the live HTML and PDF, and recheck repository Actions permissions stay disabled. This is manual publication; no cron, workflow_dispatch or automatic daily publication is required.

## Content ownership

The private ttaohe/notes repository retains Markdown articles, daily archives, referenced diagrams, the complete imported public snapshot, and reproducible resume source. See BLOG-STRUCTURE.md there. Website and VPS content are generated outputs. Do not automatically publish new material. Daily briefings are delivered in chat and published only after the owner approves that issue.

The old JSON/VPS-based excerpt adapter remains for compatibility during the research site's static migration. Do not treat unfinished VPS admin retirement or the new domain cutover as completed merely because the personal homepage was published.
