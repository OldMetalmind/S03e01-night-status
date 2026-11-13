import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { createStatusServer } from "../server.mjs";

const sampleFeed = {
  updatedAt: "2026-11-09T15:04:05.000Z",
  incidents: [
    { id: "old", line: "tram 3", opened: "2026-11-01T10:00:00Z", closed: "2026-11-01T10:30:00Z", what: "outside window", author: "Ops" },
    { id: "recent-older", line: "tram 3", opened: "2026-11-06T09:00:00Z", closed: null, what: "Earlier issue", author: "—" },
    { id: "other-line", line: "tram 4", opened: "2026-11-09T08:30:00Z", closed: "2026-11-09T09:00:00Z", what: "Signal delay", author: "Ari" },
    { id: "recent-newest", line: "tram 3", opened: "2026-11-09T14:15:00Z", closed: "2026-11-09T14:45:00Z", what: "Latest issue", author: "Sam" },
  ],
};

async function withServer(options, callback) {
  const server = createStatusServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function mockFeed(feed = sampleFeed, record = () => {}) {
  return async (url, options) => {
    record(url, options);
    return Response.json(feed);
  };
}

async function get(baseUrl, path, method = "GET") {
  return fetch(new URL(path, baseUrl), { method });
}

function rawRequest(baseUrl, path, method = "GET") {
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

test("GET / renders the live incident summary and newest-first history", async () => {
  const calls = [];
  await withServer({ fetchFeed: mockFeed(sampleFeed, (...args) => calls.push(args)) }, async (baseUrl) => {
    const response = await get(baseUrl, "/");
    const page = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.equal(response.headers.get("cache-control"), "public, max-age=30");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(page, /Updated 2026-11-09T15:04:05\.000Z/);
    assert.match(page, /Latest issue/);
    assert.match(page, /Earlier issue/);
    assert.doesNotMatch(page, /outside window/);
    assert.match(page, /tram 3[\s\S]*Latest issue[\s\S]*14:15[\s\S]*14:45/);
    assert.match(page, /tram 4[\s\S]*Signal delay/);
    assert.ok(page.indexOf("Latest issue") < page.indexOf("Earlier issue"), "incidents should be newest first");
    assert.match(page, /09\/11 \(day\/month\) · 11\/09 \(month\/day\)/);
    assert.match(page, /Who ran it/);
    assert.match(page, /<td>—<\/td>/, "missing authors should use the reference default");
    assert.match(page, /All times shown in UTC/);
    assert.match(page, /Source-cited requirements/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "https://hq.mega.dev/challenges/status-for-the-night/api/incidents/2b04e228c66a");
    assert.deepEqual(calls[0][1].headers, { Accept: "application/json" });
    assert.equal(calls[0][1].cache, "no-store");
    assert.equal(calls[0][1].signal instanceof AbortSignal, true);
    assert.equal(calls[0][1].signal.aborted, false);
  });
});

test("incident JSON is live, filtered, ordered, and distinct from requirements data", async () => {
  const calls = [];
  await withServer({ fetchFeed: mockFeed(sampleFeed, (...args) => calls.push(args)) }, async (baseUrl) => {
    const response = await get(baseUrl, "/status.json");
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "public, max-age=30");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const status = JSON.parse(body);
    assert.equal(status.updatedAt, sampleFeed.updatedAt);
    assert.deepEqual(status.incidents.map(({ id }) => id), ["recent-newest", "other-line", "recent-older"]);
    assert.equal(status.incidents[2].author, "—");
    assert.equal(calls.length, 1);

    const requirements = await get(baseUrl, "/content/requirements.json");
    const requirementsBody = await requirements.text();
    assert.equal(requirements.status, 200);
    assert.equal(requirements.headers.get("cache-control"), "public, max-age=30");
    const data = JSON.parse(requirementsBody);
    assert.equal(data.state, "awaiting-course-acceptance");
    assert.deepEqual(data.requirements.map(({ id, text, state }) => ({ id, text, state })), [
      {
        id: "candidate-source-provenance",
        text: "The status page should make clear where its information comes from.",
        state: "candidate",
      },
      {
        id: "candidate-tram-3-board-message",
        text: 'The status page should say "read by tram 3 boards".',
        state: "candidate",
      },
    ]);
    assert.deepEqual(data.requirements[0].citations, [{
      sourceId: "SRC-01",
      locator: "User-provided memo text, line 1",
      note: "Product confirmed this applies to status-page source provenance; candidate only.",
    }]);
    assert.deepEqual(data.requirements[1].citations, [{
      sourceId: "SRC-06",
      locator: "Challenge-page tram 3 board note",
      note: "Candidate evidence only; not yet part of an accepted requirements list.",
    }]);
    assert.doesNotMatch(requirementsBody, /recent-newest|Signal delay/);
    assert.doesNotMatch(requirementsBody, /UPLOAD_TOKEN\s*[:=]|Bearer\s+[A-Za-z0-9._-]{16,}|https?:\/\/[^\s"']*[?&]t=/i);
    assert.equal(calls.length, 1, "requirements endpoint must not fetch the incident feed");
  });
});

test("/requirements retains the source-cited page and links to the incident page", async () => {
  let feedCalls = 0;
  await withServer({ fetchFeed: mockFeed(sampleFeed, () => feedCalls++) }, async (baseUrl) => {
    const page = await get(baseUrl, "/requirements");
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /Awaiting course acceptance/);
    assert.match(html, /Cited candidates<\/dt><dd id="source-count">2 candidates/);
    assert.match(html, /All six source entries have been inventoried/);
    assert.match(html, /Two candidate requirements are listed from SRC-01 and SRC-06/);
    assert.match(html, /No consolidated list has been accepted/);
    assert.match(html, /href="content\/requirements\.json">View JSON/);
    assert.match(html, /href="\/"/);
    assert.match(html, /Incident status/);
    assert.equal(page.headers.get("cache-control"), "public, max-age=300");
    for (const [path, mediaType] of [
      ["/app.js", "text/javascript"],
      ["/styles.css", "text/css"],
      ["/favicon.svg", "image/svg+xml"],
    ]) {
      const asset = await get(baseUrl, path);
      assert.equal(asset.status, 200, path);
      assert.ok(asset.headers.get("content-type").startsWith(mediaType), path);
      assert.ok((await asset.arrayBuffer()).byteLength > 0, path);
    }
    assert.equal(feedCalls, 0, "requirements page and assets must not use the incident feed");
  });
});

test("both incident routes fetch the upstream feed, including HEAD requests", async () => {
  const calls = [];
  await withServer({ fetchFeed: mockFeed(sampleFeed, (...args) => calls.push(args)) }, async (baseUrl) => {
    for (const path of ["/", "/status.json"]) {
      const response = await get(baseUrl, path, "HEAD");
      assert.equal(response.status, 200, path);
      assert.equal(await response.text(), "", path);
      assert.ok(Number(response.headers.get("content-length")) > 0, path);
    }
    assert.equal(calls.length, 2);
  });
});

test("PRODUCT_POLICY can change date format, history window, and missing-author text", async () => {
  const policy = JSON.stringify({ history: "last-night", dateFormat: "month-first", missingAuthor: "Unknown" });
  await withServer({ fetchFeed: mockFeed(sampleFeed), policy }, async (baseUrl) => {
    const response = await get(baseUrl, "/status.json");
    const status = await response.json();
    assert.deepEqual(status.incidents.map(({ id }) => id), ["recent-newest", "other-line"]);
    assert.equal(status.incidents.some(({ author }) => author === "Unknown"), false);

    const page = await (await get(baseUrl, "/")).text();
    assert.match(page, /11\/09/);
    assert.doesNotMatch(page, /day\/month/);
  });

  const noAuthor = {
    updatedAt: sampleFeed.updatedAt,
    incidents: [{ line: "tram 3", opened: "2026-11-09T08:00:00Z", closed: null, what: "No author", author: null }],
  };
  await withServer({ fetchFeed: mockFeed(noAuthor), policy: JSON.stringify({ missingAuthor: "Unassigned" }) }, async (baseUrl) => {
    const status = await (await get(baseUrl, "/status.json")).json();
    assert.equal(status.incidents[0].author, "Unassigned");
  });
});

test("all feed-derived HTML values are escaped", async () => {
  const hostileFeed = {
    updatedAt: '<script>alert("updated")</script>',
    incidents: [{
      line: '<img src=x onerror="line">',
      opened: "2026-11-09T08:00:00Z",
      closed: null,
      what: '<svg onload="what"> & "danger"',
      author: "<script>alert('author')</script>",
    }],
  };
  await withServer({ fetchFeed: mockFeed(hostileFeed) }, async (baseUrl) => {
    const page = await (await get(baseUrl, "/")).text();
    assert.match(page, /&lt;script&gt;alert\(&quot;updated&quot;\)&lt;\/script&gt;/);
    assert.match(page, /&lt;img src=x onerror=&quot;line&quot;&gt;/);
    assert.match(page, /&lt;svg onload=&quot;what&quot;&gt; &amp; &quot;danger&quot;/);
    assert.match(page, /&lt;script&gt;alert\(&#39;author&#39;\)&lt;\/script&gt;/);
    assert.doesNotMatch(page, /<script>|<img src=x|<svg onload/);
  });
});

test("invalid policy, upstream errors, timeout, and malformed JSON return non-cacheable 503", async () => {
  const cases = [
    ["invalid JSON policy", { fetchFeed: mockFeed(), policy: "{" }],
    ["invalid policy choice", { fetchFeed: mockFeed(), policy: JSON.stringify({ dateFormat: "guess" }) }],
    ["upstream HTTP error", { fetchFeed: async () => new Response("unavailable", { status: 502 }) }],
    ["upstream timeout", { fetchFeed: async () => { throw new DOMException("Timed out", "TimeoutError"); } }],
    ["malformed upstream JSON", { fetchFeed: async () => new Response("{not-json", { status: 200 }) }],
    ["invalid feed shape", { fetchFeed: async () => Response.json({ updatedAt: "today", incidents: "no" }) }],
  ];
  for (const [label, options] of cases) {
    await withServer(options, async (baseUrl) => {
      const response = await get(baseUrl, "/status.json");
      assert.equal(response.status, 503, label);
      assert.equal(response.headers.get("cache-control"), "no-store", label);
      assert.equal(response.headers.get("access-control-allow-origin"), "*", label);
      assert.match(await response.text(), /Status temporarily unavailable/, label);
    });
  }
});

test("health check is separate and does not fetch the feed", async () => {
  let calls = 0;
  await withServer({ fetchFeed: mockFeed(sampleFeed, () => calls++) }, async (baseUrl) => {
    const response = await get(baseUrl, "/healthz");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok\n");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls, 0);
  });
});

test("HEAD returns headers without a body on requirements routes", async () => {
  await withServer({ fetchFeed: mockFeed() }, async (baseUrl) => {
    for (const path of ["/requirements", "/content/requirements.json"]) {
      const head = await get(baseUrl, path, "HEAD");
      const getResponse = await get(baseUrl, path);
      assert.equal(head.status, 200, path);
      assert.equal(head.headers.get("content-length"), String((await getResponse.arrayBuffer()).byteLength), path);
      assert.equal(await head.text(), "", path);
    }
  });
});

test("OPTIONS returns CORS preflight headers without fetching the feed", async () => {
  let calls = 0;
  await withServer({ fetchFeed: mockFeed(sampleFeed, () => calls++) }, async (baseUrl) => {
    const response = await fetch(new URL("/status.json", baseUrl), {
      method: "OPTIONS",
      headers: { Origin: "https://client.example", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization, content-type" },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
    assert.equal(response.headers.get("access-control-allow-headers"), "authorization, content-type");
    assert.equal(calls, 0);
  });
});

test("unknown paths are not served from the project filesystem", async () => {
  await withServer({ fetchFeed: mockFeed() }, async (baseUrl) => {
    for (const path of ["/missing", "/README.md", "/server.mjs", "/content/requirements.md", "/inputs/originals/source.pdf"]) {
      const response = await get(baseUrl, path);
      assert.equal(response.status, 404, path);
    }
  });
});

test("unsupported methods return 405 and an Allow header", async () => {
  await withServer({ fetchFeed: mockFeed() }, async (baseUrl) => {
    for (const [path, method, allow] of [["/", "POST", "GET, HEAD"], ["/status.json", "PUT", "GET, HEAD"], ["/healthz", "HEAD", "GET"]]) {
      const response = await get(baseUrl, path, method);
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), allow);
    }
  });
});

test("malformed and traversal-like paths are handled safely", async () => {
  await withServer({ fetchFeed: mockFeed() }, async (baseUrl) => {
    const malformed = await rawRequest(baseUrl, "/%E0%A4%A");
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body, "Bad Request\n");

    for (const path of ["/%2e%2e/content/requirements.json", "/%2Fetc%2Fpasswd", "/..%2fREADME.md"]) {
      const response = await rawRequest(baseUrl, path);
      assert.equal(response.status, 404, path);
    }
  });
});
