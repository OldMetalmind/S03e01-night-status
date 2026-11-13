import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const siteRoot = resolve(projectRoot, "site");
const requirementsPath = resolve(projectRoot, "content/requirements.json");

const assets = new Map([
  ["/", { path: resolve(siteRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/app.js", { path: resolve(siteRoot, "app.js"), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { path: resolve(siteRoot, "styles.css"), type: "text/css; charset=utf-8" }],
  ["/favicon.svg", { path: resolve(siteRoot, "favicon.svg"), type: "image/svg+xml" }],
]);

const jsonRoutes = new Set(["/content/requirements.json", "/status.json"]);
const cacheControl = "public, max-age=30";

function sendText(response, statusCode, text, { head = false, type = "text/plain; charset=utf-8", headers = {} } = {}) {
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

export function createStatusServer() {
  return createServer(async (request, response) => {
    const pathname = requestPath(request.url);
    if (pathname === null) {
      sendText(response, 400, "Bad Request\n", { head: request.method === "HEAD", headers: { "Cache-Control": "no-store" } });
      return;
    }

    if (pathname === "/healthz") {
      if (request.method !== "GET") {
        sendText(response, 405, "Method Not Allowed\n", { headers: { Allow: "GET" } });
        return;
      }
      sendText(response, 200, "ok\n", { headers: { "Cache-Control": "no-store" } });
      return;
    }

    const asset = assets.get(pathname);
    const isJson = jsonRoutes.has(pathname);
    if (!asset && !isJson) {
      sendText(response, 404, "Not Found\n", { head: request.method === "HEAD", headers: { "Cache-Control": "no-store" } });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method Not Allowed\n", { headers: { Allow: "GET, HEAD" } });
      return;
    }

    const head = request.method === "HEAD";
    const headers = { "Cache-Control": isJson ? cacheControl : "public, max-age=300" };
    try {
      if (isJson) {
        const body = await readFile(requirementsPath);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": body.length,
          "X-Content-Type-Options": "nosniff",
          ...headers,
        });
        response.end(head ? undefined : body);
        return;
      }

      const fileInfo = await stat(asset.path);
      response.writeHead(200, {
        "Content-Type": asset.type,
        "Content-Length": fileInfo.size,
        "X-Content-Type-Options": "nosniff",
        ...headers,
      });
      if (head) {
        response.end();
        return;
      }
      const stream = createReadStream(asset.path);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
      } else {
        sendText(response, 500, "Internal Server Error\n", { head, headers: { "Cache-Control": "no-store" } });
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
