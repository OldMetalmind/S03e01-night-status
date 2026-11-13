# Render deployment and cutover

## Prepared configuration

`render.yaml` defines a **Node.js Web Service** named `s03e01-night-status`, tracking the `main` branch of this repository, with automatic deploys, the free plan, a build-time validation/test command, and `/healthz` as the health check. `server.mjs` binds to `0.0.0.0` and uses Render's `PORT`. The service has no runtime dependencies or upstream incident-feed integration.

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
   - `/` displays the status page and its exact pre-acceptance message.
   - `/content/requirements.json` contains the current sanitized candidate data.
   - `/status.json` returns the same JSON as `/content/requirements.json`.
4. Check that the page remains marked **Awaiting course acceptance**, and the candidate wording remains exactly `The status page should say "read by tram 3 boards".` with state `candidate`. Do not imply the challenge is solved or promote the candidate to an accepted requirement.
5. Confirm that no originals, private evidence, signed URLs, credentials, or tokens are exposed. The server allowlists only the page assets and sanitized JSON.
6. Only after all checks pass, update the project/public-page documentation with the verified canonical URL, disable GitHub Pages publishing and hosting, and retain the Pages repository and its content for rollback. Until then, leave the existing Pages site active. Do not run `scripts/publish-pages.sh` as part of normal Render deployment.

## Endpoint behavior

- `GET /` serves the page; `GET /app.js`, `/styles.css`, and `/favicon.svg` serve its existing assets.
- `GET /content/requirements.json` and `GET /status.json` return the same sanitized JSON with a 30-second cache lifetime.
- `GET /healthz` returns a simple health response.
- `HEAD` is supported for the page and JSON routes. Unknown paths return `404`; unsupported methods return `405` with an `Allow` header. Malformed path encodings return `400`.

The separate 30-second tram-board capture workflow remains separate; snapshots are not published or integrated into this page.
