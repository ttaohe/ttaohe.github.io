"""Detect common credential formats without printing or transmitting matches."""
import re
import subprocess
import sys

PATTERN = re.compile(rb"(?:AKIA|ASIA)[0-9A-Z]{16}|sk-(?:ant|proj)-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|glpat-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|SG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")

def audit():
    process = subprocess.Popen(["git", "log", "--all", "--format=", "-p", "--no-ext-diff", "--no-textconv"], stdout=subprocess.PIPE)
    count = sum(bool(PATTERN.search(line)) for line in process.stdout)
    if process.wait():
        raise RuntimeError("Git history scan failed")
    print(f"Credential-pattern scan: {count} matching history lines. Values are never logged.")
    print("This format-based check can have false positives and does not cover every secret type.")
    return 1 if count else 0

if __name__ == "__main__":
    sys.exit(audit())
