#!/bin/sh
# Fetch an explicitly pinned public code bundle. No secrets or private data.
set -eu
URL=${1:-}; DIGEST=${2:-}; DESTINATION=${3:-}
case "$URL" in https://*) ;; *) echo 'HTTPS bundle URL required' >&2; exit 1;; esac
[ "${#DIGEST}" -eq 64 ] || { echo 'Pinned SHA-256 required' >&2; exit 1; }
case "$DIGEST" in *[!0-9a-f]*) exit 1;; esac
[ -n "$DESTINATION" ] && [ ! -e "$DESTINATION" ] || { echo 'New destination directory required' >&2; exit 1; }
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT
curl --silent --show-error --fail --location --proto '=https' --proto-redir '=https' --connect-timeout 10 --max-time 120 --output "$TEMP/code.tar.gz" "$URL"
python3 - "$TEMP/code.tar.gz" "$DIGEST" "$DESTINATION" <<'PY'
import hashlib,sys,tarfile
from pathlib import Path
source,digest,destination=sys.argv[1:]
if hashlib.sha256(Path(source).read_bytes()).hexdigest()!=digest: raise SystemExit('Bundle SHA-256 mismatch')
with tarfile.open(source,'r:gz') as archive:
 members=archive.getmembers()
 if sum(m.size for m in members)>4*1024*1024: raise SystemExit('Bundle too large')
 for member in members:
  path=Path(member.name)
  if path.is_absolute() or '..' in path.parts or not member.isfile(): raise SystemExit('Unsafe archive member')
 Path(destination).mkdir(mode=0o700)
 for member in members:
  target=Path(destination)/member.name; target.parent.mkdir(parents=True,exist_ok=True)
  with archive.extractfile(member) as source, target.open('xb') as output:
   output.write(source.read())
  target.chmod(0o755 if member.name.endswith('.sh') else 0o644)
print('Verified public code extracted; review install.sh before root execution')
PY
