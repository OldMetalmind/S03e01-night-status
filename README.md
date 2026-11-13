# S03E01 Night Status

Public project repository for the MEGA.dev S03E01 **status for the night** challenge. The status page is prepared for a dependency-free Node.js Web Service on Render.

## Hosting and cutover status

- **Target host:** Render Web Service, service name `s03e01-night-status` (configured in [`render.yaml`](render.yaml)).
- **Expected URL:** https://s03e01-night-status.onrender.com, subject to availability when the service is created.
- **Current state:** the Render Blueprint and application are ready, but the external Render service has not been created or verified. Do not treat the target URL as live yet.
- **Rollback/current URL:** https://oldmetalmind.github.io/s03e01/ remains available until Render HTTPS health, page, and JSON checks pass. Only then should GitHub Pages publishing and hosting be disabled. The Pages repository is retained for rollback.

See [docs/RENDER-DEPLOYMENT.md](docs/RENDER-DEPLOYMENT.md) for the approved cutover procedure and checks.

## Public/private boundary

This repository contains only the static page, sanitized requirements data, and publication tooling. The five original source files, private review evidence, Cloudflare credentials, `UPLOAD_TOKEN`, cookies, and tokenized Challenge URLs must never be committed here.

Source intake is handled through a public GitHub **Source delivery** ticket. See [SOURCE-DELIVERY.md](SOURCE-DELIVERY.md). Requirements become public only after Product resolves conflicts and MEGA.dev accepts the consolidated list. Cloudflare is not an active intake or publication dependency.

## Local preview and checks

Use Node.js 22 or later:

```bash
npm start
# open http://127.0.0.1:3000/
```

Run the full build checks (syntax, content validation, and HTTP server tests):

```bash
npm run build
```

You can also run the checks individually with `npm run validate` and `npm test`.

The server binds to `0.0.0.0` and uses `PORT` when set. It serves only the allowlisted site assets and sanitized `content/requirements.json`; it does not expose the rest of the repository or connect to an upstream incidents feed.

## Repository layout

- `site/` — deployable page and assets
- `content/` — sanitized requirements and source-citation data
- `server.mjs` — dependency-free HTTP server
- `test/` — Node.js HTTP behavior tests
- `scripts/` — content validation and retained rollback publication tooling
- `docs/` — deployment and publication notes
- `.github/workflows/` — validation CI
