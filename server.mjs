import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(projectRoot, "site");
const requirementsPath = resolve(projectRoot, "content/requirements.json");
const incidentFeedUrl = "https://hq.mega.dev/challenges/status-for-the-night/api/incidents/2b04e228c66a";
const weekMilliseconds = 7 * 24 * 60 * 60 * 1000;

const assets = new Map([
  ["/requirements", { path: resolve(siteRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/app.js", { path: resolve(siteRoot, "app.js"), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { path: resolve(siteRoot, "styles.css"), type: "text/css; charset=utf-8" }],
  ["/favicon.svg", { path: resolve(siteRoot, "favicon.svg"), type: "image/svg+xml" }],
]);

const corsHeaders = { "Access-Control-Allow-Origin": "*" };
const jsonHeaders = { ...corsHeaders, "Cache-Control": "public, max-age=30" };
const defaultPolicy = Object.freeze({ history: "week", dateFormat: "both", missingAuthor: "—" });

function sendText(response, statusCode, text, {
  head = false,
  type = "text/plain; charset=utf-8",
  headers = {},
} = {}) {
  const body = Buffer.from(text);
  response.writeHead(statusCode, {
    "Content-Type": type,
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(head ? undefined : body);
}

function requestPath(requestUrl) {
  if (typeof requestUrl !== "string" || !requestUrl.startsWith("/")) return null;
  const rawPath = requestUrl.split("?", 1)[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
}

function parsePolicy(value) {
  let configured = {};
  if (value) {
    configured = typeof value === "string" ? JSON.parse(value) : value;
    if (!configured || typeof configured !== "object" || Array.isArray(configured)) {
      throw new Error("PRODUCT_POLICY must be a JSON object");
    }
  }
  const policy = { ...defaultPolicy, ...configured };
  if (!new Set(["day-first", "month-first", "both"]).has(policy.dateFormat)
    || !new Set(["last-night", "week"]).has(policy.history)
    || typeof policy.missingAuthor !== "string"
    || !policy.missingAuthor.trim()) {
    throw new Error("Invalid PRODUCT_POLICY");
  }
  return policy;
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function makeStatus(feed, policy = defaultPolicy) {
  if (!feed || typeof feed !== "object" || !Array.isArray(feed.incidents)
    || typeof feed.updatedAt !== "string") {
    throw new Error("Invalid incident feed");
  }

  const incidents = feed.incidents.map((incident) => {
    if (!incident || typeof incident !== "object" || Array.isArray(incident)
      || typeof incident.line !== "string" || typeof incident.what !== "string"
      || !validTimestamp(incident.opened)
      || (incident.closed !== null && incident.closed !== undefined && !validTimestamp(incident.closed))
      || (incident.author !== null && incident.author !== undefined && typeof incident.author !== "string")) {
      throw new Error("Invalid incident");
    }
    const author = incident.author && incident.author !== "—" ? incident.author : policy.missingAuthor;
    return { ...incident, author };
  });

  if (incidents.length === 0) return { updatedAt: feed.updatedAt, incidents };

  const newest = Math.max(...incidents.map((incident) => Date.parse(incident.opened)));
  const cutoff = policy.history === "week"
    ? newest - weekMilliseconds
    : Date.parse(`${new Date(newest).toISOString().slice(0, 10)}T00:00:00Z`) - 12 * 60 * 60 * 1000;
  const filtered = incidents
    .filter((incident) => Date.parse(incident.opened) >= cutoff)
    .sort((a, b) => Date.parse(b.opened) - Date.parse(a.opened));

  return { updatedAt: feed.updatedAt, incidents: filtered };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatTime(value) {
  return value ? new Date(value).toISOString().slice(11, 16) : "Open";
}

function formatDate(value, dateFormat) {
  const [year, month, day] = new Date(value).toISOString().slice(0, 10).split("-");
  const dayFirst = `${day}/${month}`;
  const monthFirst = `${month}/${day}`;
  if (dateFormat === "day-first") return dayFirst;
  if (dateFormat === "month-first") return monthFirst;
  return `${dayFirst} (day/month) · ${monthFirst} (month/day)`;
}

export function renderIncidentPage(status, policy = defaultPolicy) {
  const lines = [...new Set(status.incidents.map((incident) => incident.line))];
  const lineRows = lines.map((line) => {
    const incident = status.incidents.find((entry) => entry.line === line);
    return `<tr><td>${escapeHtml(line)}</td><td>${escapeHtml(incident.what)}</td><td>${formatTime(incident.opened)}</td><td>${formatTime(incident.closed)}</td></tr>`;
  }).join("");
  const incidentRows = status.incidents.map((incident) => `<tr><td>${formatDate(incident.opened, policy.dateFormat)}</td><td>${formatTime(incident.opened)}</td><td>${formatTime(incident.closed)}</td><td>${escapeHtml(incident.line)}</td><td>${escapeHtml(incident.what)}</td><td>${escapeHtml(incident.author)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Live MEGA.dev incident status for night operations.">
    <title>status for the night</title>
    <style>
      :root { color-scheme: light; font-family: system-ui, sans-serif; color: #222; background: #f5f4f1; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      aside { padding: 1rem max(1.5rem, calc((100% - 1000px) / 2)); background: #6f55c9; color: #fff; }
      main { max-width: 1000px; margin: auto; padding: 2rem 1.5rem 3rem; }
      h1 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 600; letter-spacing: -.04em; }
      h2 { font-size: 1.4rem; }
      .muted, footer { color: #626262; }
      section { margin: 1.5rem 0; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
      .scroll { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; text-align: left; font-size: .9rem; }
      th, td { padding: .75rem .5rem; border-bottom: 1px solid #ddd; vertical-align: top; }
      th { color: #555; }
      a { color: #45318b; }
      nav { display: flex; flex-wrap: wrap; gap: 1rem; }
      footer { font-size: .875rem; line-height: 1.8; }
    </style>
  </head>
  <body>
    <aside>Some services had problems overnight.</aside>
    <main>
      <nav aria-label="Status pages"><a href="/">Incident status</a><a href="/requirements">Source-cited requirements</a><a href="/status.json">JSON feed</a></nav>
      <p class="muted">sched-prod · night operations</p>
      <h1>status for the night</h1>
      <p>Updated ${escapeHtml(status.updatedAt)} · All times UTC</p>
      <section aria-labelledby="lines-title">
        <h2 id="lines-title">Lines</h2>
        <div class="scroll"><table><thead><tr><th>Line</th><th>Latest incident</th><th>Opened</th><th>Closed</th></tr></thead><tbody>${lineRows}</tbody></table></div>
      </section>
      <section aria-labelledby="history-title">
        <h2 id="history-title">Incident history</h2>
        <div class="scroll"><table><thead><tr><th>Date</th><th>Opened</th><th>Closed</th><th>Line</th><th>What happened</th><th>Who ran it</th></tr></thead><tbody>${incidentRows}</tbody></table></div>
      </section>
      <footer>All times shown in UTC.<br>Incident feed refreshed for each page request.<br><a href="/requirements">View source-cited requirements</a>.</footer>
    </main>
  </body>
</html>`;
}

export function createStatusServer({ fetchFeed = fetch, policy = process.env.PRODUCT_POLICY } = {}) {
  return createServer(async (request, response) => {
    const pathname = requestPath(request.url);
    const head = request.method === "HEAD";

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": request.headers["access-control-request-headers"] || "Content-Type",
        "Cache-Control": "no-store",
        "Content-Length": 0,
      });
      response.end();
      return;
    }

    if (pathname === null) {
      sendText(response, 400, "Bad Request\n", { head, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
      return;
    }

    if (pathname === "/healthz") {
      if (request.method !== "GET") {
        sendText(response, 405, "Method Not Allowed\n", { headers: { ...corsHeaders, Allow: "GET", "Cache-Control": "no-store" } });
        return;
      }
      sendText(response, 200, "ok\n", { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
      return;
    }

    const isIncidentRoute = pathname === "/" || pathname === "/status.json";
    const asset = assets.get(pathname);
    const isRequirementsJson = pathname === "/content/requirements.json";
    if (!isIncidentRoute && !asset && !isRequirementsJson) {
      sendText(response, 404, "Not Found\n", { head, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method Not Allowed\n", {
        headers: { ...corsHeaders, Allow: "GET, HEAD", "Cache-Control": "no-store" },
      });
      return;
    }

    if (isIncidentRoute) {
      try {
        const activePolicy = parsePolicy(policy);
        const upstream = await fetchFeed(incidentFeedUrl, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!upstream.ok) throw new Error("Incident feed unavailable");
        const status = makeStatus(await upstream.json(), activePolicy);
        const isJson = pathname === "/status.json";
        const body = isJson ? JSON.stringify(status) : renderIncidentPage(status, activePolicy);
        sendText(response, 200, body, {
          head,
          type: isJson ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
          headers: isJson
            ? { ...jsonHeaders }
            : { ...corsHeaders, "Cache-Control": "public, max-age=30" },
        });
      } catch {
        sendText(response, 503, "Status temporarily unavailable\n", {
          head,
          headers: { ...corsHeaders, "Cache-Control": "no-store" },
        });
      }
      return;
    }

    try {
      if (isRequirementsJson) {
        const body = await readFile(requirementsPath);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": body.length,
          "X-Content-Type-Options": "nosniff",
          ...corsHeaders,
          "Cache-Control": "public, max-age=30",
        });
        response.end(head ? undefined : body);
        return;
      }

      const body = await readFile(asset.path);
      response.writeHead(200, {
        "Content-Type": asset.type,
        "Content-Length": body.length,
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders,
        "Cache-Control": "public, max-age=300",
      });
      response.end(head ? undefined : body);
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
      } else {
        sendText(response, 500, "Internal Server Error\n", {
          head,
          headers: { ...corsHeaders, "Cache-Control": "no-store" },
        });
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer between 1 and 65535");
    process.exitCode = 1;
  } else {
    const server = createStatusServer();
    server.listen(port, "0.0.0.0", () => {
      console.log(`S03E01 status page listening on 0.0.0.0:${port}`);
    });
  }
}
