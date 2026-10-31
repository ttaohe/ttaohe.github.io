.PHONY: generate check preview publish-preview publish

generate:
	node scripts/prepare-publish.mjs
	node scripts/finalize-homepage.mjs

check:
	node scripts/check-maintenance.mjs
	node --test scripts/portfolio-*.test.mjs

preview: generate
	python3 -m http.server 4173 --directory publish

publish-preview:
	node scripts/publish-homepage.mjs

publish:
	node scripts/publish-homepage.mjs --apply
