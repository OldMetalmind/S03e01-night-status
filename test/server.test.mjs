import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { after, before, test } from "node:test";
import { createStatusServer } from "../server.mjs";

let server;
let baseUrl;

before(async () => {
  server = createStatusServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, "close");
});

async function get(path, method = "GET") {
  return fetch(new URL(path, baseUrl), { method });
}

function rawRequest(path, method = "GET") {
  return new Promise((resolve, reject) => {
    const address = new URL(baseUrl);
    const request = httpRequest({ hostname: address.hostname, port: address.port, path, method }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("GET / serves the existing page and expected assets", async () => {
  const page = await get("/");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /^text\/html/);
  assert.match(await page.text(), /Awaiting course acceptance/);

  for (const [path, mediaType] of [
    ["/app.js", "text/javascript"],
    ["/styles.css", "text/css"],
    ["/favicon.svg", "image/svg+xml"],
  ]) {
    const asset = await get(path);
    assert.equal(asset.status, 200, path);
    assert.ok(asset.headers.get("content-type").startsWith(mediaType), path);
    assert.ok((await asset.arrayBuffer()).byteLength > 0, path);
  }
});

test("requirements and compatibility JSON routes return identical sanitized data", async () => {
  const primary = await get("/content/requirements.json");
  const alias = await get("/status.json");
  const primaryBody = await primary.text();
  assert.equal(primary.status, 200);
  assert.equal(alias.status, 200);
  assert.equal(alias.headers.get("cache-control"), "public, max-age=30");
  assert.equal(await alias.text(), primaryBody);

  const data = JSON.parse(primaryBody);
  assert.equal(data.state, "awaiting-course-acceptance");
  assert.deepEqual(data.requirements.map(({ id, text, state }) => ({ id, text, state })), [
    {
      id: "candidate-tram-3-board-message",
      text: 'The status page should say "read by tram 3 boards".',
      state: "candidate",
    },
  ]);
  assert.doesNotMatch(primaryBody, /UPLOAD_TOKEN\s*[:=]|Bearer\s+[A-Za-z0-9._-]{16,}|https?:\/\/[^\s"']*[?&]t=/i);
});

test("GET /healthz returns a simple health response", async () => {
  const response = await get("/healthz");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok\n");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("HEAD returns headers without a body for the page and JSON routes", async () => {
  for (const path of ["/", "/content/requirements.json", "/status.json"]) {
    const head = await get(path, "HEAD");
    const getResponse = await get(path);
    assert.equal(head.status, 200, path);
    assert.equal(head.headers.get("content-length"), String((await getResponse.arrayBuffer()).byteLength), path);
    assert.equal(await head.text(), "", path);
  }
});

test("unknown paths are not served from the project filesystem", async () => {
  for (const path of ["/missing", "/README.md", "/server.mjs", "/content/requirements.md", "/inputs/originals/source.pdf"]) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
  }
});

test("unsupported methods return 405 and an Allow header", async () => {
  for (const [path, method, allow] of [["/", "POST", "GET, HEAD"], ["/healthz", "HEAD", "GET"]]) {
    const response = await get(path, method);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), allow);
  }
});

test("malformed and traversal-like paths are handled safely", async () => {
  const malformed = await rawRequest("/%E0%A4%A");
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body, "Bad Request\n");

  for (const path of ["/%2e%2e/content/requirements.json", "/%2Fetc%2Fpasswd", "/..%2fREADME.md"]) {
    const response = await rawRequest(path);
    assert.equal(response.status, 404, path);
  }
});
