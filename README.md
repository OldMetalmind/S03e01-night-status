# S03E01 Night Status

Public project repository for the MEGA.dev S03E01 **status for the night** challenge.

The deployable page is published at:

**https://oldmetalmind.github.io/s03e01/**

## Public/private boundary

This repository contains only the static page, sanitized requirements data, and publication tooling. The five original source files, private review evidence, Cloudflare credentials, `UPLOAD_TOKEN`, cookies, and tokenized Challenge URLs must never be committed here.

Source intake is handled through a public GitHub **Source delivery** ticket. See [SOURCE-DELIVERY.md](SOURCE-DELIVERY.md). Requirements become public only after Product resolves conflicts and MEGA.dev accepts the consolidated list. Cloudflare is not an active intake or publication dependency.

## Local preview

```bash
python3 -m http.server 8000
# open http://127.0.0.1:8000/site/
```

Validate tracked content:

```bash
node scripts/validate-content.mjs
```

## Repository layout

- `site/` — deployable static page
- `content/` — sanitized requirements and source-citation data
- `scripts/` — local and CI validation
- `docs/` — deployment and publication notes
- `.github/workflows/` — GitHub Pages publication workflow

## References

The layout and operational presentation were informed by these public repositories:

- https://github.com/artles-dev/night-status
- https://github.com/remipeli/s03e01-status-pages
- https://github.com/amtmich/mega-s03e01-night-status

Only general presentation and workflow ideas are used; source-specific content is not copied.
