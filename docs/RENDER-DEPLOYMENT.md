# Render deployment and cutover

## Prepared configuration

`render.yaml` defines a **Node.js Web Service** named `s03e01-night-status`, tracking the `main` branch of this repository, with automatic deploys, the free plan, a build-time validation/test command, and `/healthz` as the health check. `server.mjs` binds to `0.0.0.0` and uses Render's `PORT`. The incident routes fetch MEGA.dev's public feed on each request with a 10-second timeout and no credentials. No polling, cron job, or runtime dependency is used.

The expected host URL is `https://s03e01-night-status.onrender.com`; Render may require a different available hostname. Record the actual URL after creating the service and use it as canonical only after all cutover checks pass.

## External account action and cost boundary

The Blueprint is prepared in code; it does not create or connect a Render service. An authorized account owner must connect the existing `OldMetalmind/S03e01-night-status` repository and apply the Blueprint. Do not create an account, connect an account, choose a paid plan, or incur charges without separate approval. If the free Web Service plan is unavailable, stop and request approval rather than selecting a paid tier.

## Pre-deployment checks

From the project repository root, using Node.js 22 or later:

```bash
npm run build
```

This runs the syntax check, requirements validator, and HTTP server tests. Render uses the same command as its build step and starts the app with `node server.mjs`.

## Deploy and verify before cutover

1. In Render, create a Web Service from this repository's `main` branch by applying `render.yaml`. Confirm the service name is `s03e01-night-status`, the plan is free, the health check is `/healthz`, and auto-deploy tracks `main`.
2. Wait for a successful deploy and HTTPS health check. Use the actual Render URL shown by the service.
3. Verify these endpoints over HTTPS:
   - `/healthz` returns `200` and `ok`.
   - `/` renders live incident status and `/status.json` returns the corresponding live incident JSON.
   - `/requirements` remains marked **Awaiting course acceptance**.
   - `/content/requirements.json` contains the current sanitized candidate data and is distinct from `/status.json`.
4. Check that the candidate wording remains exactly `The status page should say "read by tram 3 boards".` with state `candidate`. Do not imply the challenge is solved or promote the candidate to an accepted requirement.
5. Confirm that no originals, private evidence, signed URLs, credentials, or tokens are exposed. The server allowlists only the public page assets, incident routes, and sanitized requirements JSON.
6. Only after all checks pass, update the project/public-page documentation with the verified canonical URL, disable GitHub Pages publishing and hosting, and retain the Pages repository and its content for rollback. Until then, leave the existing Pages site active. Do not run `scripts/publish-pages.sh` as part of normal Render deployment.

## Endpoint behavior

- `GET /` renders live incidents; `GET /status.json` returns the same filtered incident data as JSON. Each GET or HEAD request to either route fetches the upstream feed with a 10-second timeout. Successful responses allow CORS and use `Cache-Control: public, max-age=30`; upstream failures return non-cacheable `503` responses.
- `GET /requirements` serves the source-cited, pre-acceptance page; `GET /content/requirements.json` serves its distinct sanitized data with a 30-second cache lifetime. `/app.js`, `/styles.css`, and `/favicon.svg` remain its assets.
- `GET /healthz` returns a simple health response. `OPTIONS` supports CORS preflight.
- `HEAD` is supported for page and JSON routes. Unknown paths return `404`; unsupported methods return `405` with an `Allow` header. Malformed path encodings return `400`.

The separate 30-second tram-board capture workflow remains separate; snapshots are not published or integrated into this page. The incident feed is refreshed only in response to origin page/JSON requests; there is no polling or cron job.
