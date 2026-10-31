# Private publisher v0.2.0 — historical reproducible baseline

This release is the tested **loopback-only, single-owner v0.2.0 prototype**. It has no application authentication. Do not expose it to the internet. Later authenticated HTTPS/UI work is separate and is not included in these immutable archives.

- `private-publisher-0.2.0-source.tar.gz`: complete sanitized source, tests, benchmarks, per-file manifest and deterministic builders; 37,102 bytes
- `private-publisher-0.2.0.tar.gz`: runtime code and operational scripts; 23,713 bytes
- `fetch-code.sh`: unchanged reviewed helper from the runtime; accepts an HTTPS archive URL, pinned SHA-256 and a new destination directory
- `SHA256SUMS`: SHA-256 for the three files above

The archives contain no real content fixture, database, private backup, credentials, connection settings or server logs. Verify the archive against the independently published digest before extracting. Review installation scripts before privileged execution.

## Release verification, 2026-10-09

Both archives were transferred and checked byte for byte against their source digests. Rebuilding both archives from the full source reproduced the same bytes. Offline tests: 12 passed, 1 explicitly skipped because the optional public fixture was absent. With the checksum-verified 12,972,715-byte public fixture: all 13 tests passed. The full-fixture test includes unchanged byte-exact roundtrip, history/unknown-field preservation, selected old revisions, isolation of unselected drafts, conflict handling and local backup restoration. This is not a fresh-server restore drill or a test of the later authentication build.

Test requirements: Python 3.10+ standard library on macOS/Linux. Installation requirements: existing Linux, systemd, Python 3.10+ with SQLite, and an operator-approved dedicated service installation. No packages are downloaded by the installer. Tests do not automatically fetch a fixture; `scripts/download_fixture.py` is an explicit optional network action against a fixed already-public commit and checks its exact size and digest.

## Use

Read `SOURCE_README.md` and `PORTABLE.md` inside the source archive. `sh scripts/install.sh --plan` only validates code and shows the plan. `sudo sh scripts/install.sh --start` creates the documented dedicated account/service and starts it, so it requires the operator's authorization. Boot enablement is not performed by this v0.2 installer. Import, backup and restore operate on private state separately; code retrieval does not recover drafts, database, attachments or credentials.

The immutable archive documentation predates this publication and says a public release URL was not available. The accompanying living article and this release directory now provide the checked download locations. Do not interpret that historical note as a current missing-file error or modify the archived bytes in place.

Automatic GitHub/Drive publishing, encrypted off-site backups, attachment management, schema migration and fresh-server recovery are not delivered by this version. The later authenticated production deployment is not reproduced by installing this package.

Living article: https://ttaohe.github.io/ai-infra-daily-notes/notes/self-owned-portable-publishing-backend/

Authoritative source archive: https://drive.google.com/file/d/1LqHt7e9GKYt1Yny1Wi1swpTnrGt6QIrs/view

Authoritative runtime archive: https://drive.google.com/file/d/175Xbvuw-8ONmLAxsdlRLcw4wtji3Hu4o/view
