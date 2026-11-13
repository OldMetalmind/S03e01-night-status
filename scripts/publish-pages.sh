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
find "$tmp/pages" -mindepth 1 -maxdepth 1 ! -name .git ! -name .github ! -name .nojekyll -exec rm -rf {} +
cp site/index.html site/styles.css site/app.js site/favicon.svg "$tmp/pages"/
cp -R content "$tmp/pages/content"
printf '%s\n' "$source_commit" > "$tmp/pages/PROJECT_COMMIT_SHA"
cat > "$tmp/pages/README.md" <<EOF
# S03E01 GitHub Pages rollback copy

Published from [OldMetalmind/S03e01-night-status](https://github.com/OldMetalmind/S03e01-night-status) for rollback only.

Rollback URL: https://oldmetalmind.github.io/s03e01/

The intended active host is the Render Web Service named s03e01-night-status; keep GitHub Pages active until its HTTPS checks pass, then retain this repository and content for rollback.

Project commit: ${source_commit}

Original source files, private evidence, credentials, and upload tokens are not published here.
EOF

cd "$tmp/pages"
git add -A
git commit -m "Publish status page from project commit ${source_commit}" || {
  echo "No Pages changes to publish."
  exit 0
}
git push origin main
