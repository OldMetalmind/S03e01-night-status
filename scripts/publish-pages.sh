#!/usr/bin/env bash
set -euo pipefail

# Controlled one-way publication. Run from the project repository after review.
# Requires an already authenticated gh CLI and a clean source tree.

repo="${PAGES_REPO:-OldMetalmind/s03e01}"
source_commit="$(git rev-parse HEAD)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [[ -n "$(git status --short)" ]]; then
  echo "Refusing to publish from a dirty working tree." >&2
  exit 1
fi

git clone --depth 1 "https://github.com/${repo}.git" "$tmp/pages"
rm -rf "$tmp/pages"/* "$tmp/pages"/.[!.]* "$tmp/pages"/..?* 2>/dev/null || true
cp site/index.html site/styles.css site/app.js "$tmp/pages"/
cp -R content "$tmp/pages/content"
printf '%s\n' "$(git rev-parse HEAD)" > "$tmp/pages/PROJECT_COMMIT_SHA"
cat > "$tmp/pages/README.md" <<EOF
# S03E01 GitHub Pages

Published from [OldMetalmind/S03e01-night-status](https://github.com/OldMetalmind/S03e01-night-status).

Public URL: https://oldmetalmind.github.io/s03e01/

Project commit: $(git rev-parse HEAD)

Original source files, private evidence, credentials, and upload tokens are not published here.
EOF

cd "$tmp/pages"
git add -A
git commit -m "Publish status page from project commit ${source_commit}" || {
  echo "No Pages changes to publish."
  exit 0
}
git push origin main
