const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

test("manifest is a minimal MV3 extension scoped to Google search", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage", "webRequest"]);
  assert.ok(manifest.content_scripts[0].matches.includes("https://www.google.co.uk/search*"));
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
});

test("browser-specific manifests keep the same narrow scope", () => {
  for (const browser of ["firefox", "safari"]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests", `${browser}.json`), "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, packageVersion);
    assert.deepEqual(Array.from(manifest.permissions), ["storage", "webRequest"]);
    assert.ok(manifest.host_permissions.includes("https://www.google.co.uk/*"));
    assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  }
});

test("browser-specific release declarations satisfy signing toolchains", () => {
  const firefox = JSON.parse(fs.readFileSync(path.join(root, "manifests", "firefox.json"), "utf8"));
  assert.deepEqual(firefox.browser_specific_settings.gecko.data_collection_permissions, {
    required: ["none"]
  });

  const safari = JSON.parse(fs.readFileSync(path.join(root, "manifests", "safari.json"), "utf8"));
  assert.equal(safari.background.preferred_environment, undefined);
});

test("build produces valid PNG icons and every upload archive", () => {
  for (const size of [16, 32, 48, 64, 96, 128, 256, 512]) {
    const png = fs.readFileSync(path.join(root, "icons", `icon-${size}.png`));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  for (const browser of ["chrome", "edge", "firefox", "safari"]) {
    const archive = path.join(root, "dist", `google-goto-url-fix-${browser}-${packageVersion}.zip`);
    const zip = fs.readFileSync(archive);
    assert.ok(zip.length > 0, `${browser} archive is missing`);
    assert.equal(zip.subarray(0, 4).toString("hex"), "504b0304", `${browser} is not a ZIP`);
    assert.ok(zip.includes(Buffer.from("manifest.json")), `${browser} manifest is missing`);
    assert.ok(zip.includes(Buffer.from("assets/chrome-incognito-setting.png")), `${browser} tutorial screenshot is missing`);
    assert.ok(zip.includes(Buffer.from("assets/chrome-extension-list.png")), `${browser} tutorial screenshot is missing`);
  }
});

test("store artwork has the required marketplace dimensions", () => {
  const expected = {
    "store-screenshot-1280x800.png": [1280, 800],
    "promo-small-440x280.png": [440, 280],
    "promo-marquee-1400x560.png": [1400, 560]
  };
  for (const [file, [width, height]] of Object.entries(expected)) {
    const png = fs.readFileSync(path.join(root, "store", "assets", file));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), width, `${file} width`);
    assert.equal(png.readUInt32BE(20), height, `${file} height`);
  }
});

test("all JavaScript parses", () => {
  for (const file of ["background.js", "content.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotThrow(() => new Function(source), file);
  }
});

function loadBackground(fetchImpl, extensionOrigin = "chrome-extension://test") {
  let messageListener;
  let redirectListener;
  let beforeRequestListener;
  let headersReceivedListener;
  let installedListener;
  const openedTabs = [];
  const noOpEvent = { addListener() {} };
  const stored = { enabled: true };
  const action = {};
  const context = {
    URL,
    AbortController,
    fetch: fetchImpl,
    chrome: {
      storage: { local: {
        get: async () => ({ ...stored }),
        set: async (values) => { Object.assign(stored, values); }
      } },
      action: {
        setBadgeText: async ({ text }) => { action.text = text; },
        setBadgeBackgroundColor: async ({ color }) => { action.color = color; },
        setTitle: async ({ title }) => { action.title = title; },
        onClicked: noOpEvent
      },
      runtime: {
        getURL: (path = "") => `${extensionOrigin}/${path}`,
        onInstalled: { addListener(listener) { installedListener = listener; } },
        onStartup: noOpEvent,
        onMessage: { addListener(listener) { messageListener = listener; } }
      },
      webRequest: {
        onBeforeRequest: { addListener(listener) { beforeRequestListener = listener; } },
        onBeforeRedirect: { addListener(listener) { redirectListener = listener; } },
        onHeadersReceived: { addListener(listener) { headersReceivedListener = listener; } }
      },
      tabs: { sendMessage: async () => {}, create: async tab => { openedTabs.push(tab); } }
    },
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "background.js"), "utf8"),
    context
  );
  const send = (message) => new Promise((resolve) => messageListener(message, {}, resolve));
  send.promote = (url) => messageListener({ type: "promote-goto", url }, {}, () => {});
  send.beforeRequest = (url, requestId = "extension-request", initiator = "chrome-extension://test", tabId = -1) => {
    beforeRequestListener({ url, requestId, initiator, tabId });
  };
  send.rawBeforeRequest = details => beforeRequestListener(details);
  send.rawHeaders = details => headersReceivedListener(details);
  send.redirect = (url, redirectUrl, requestId = "extension-request") => {
    send.beforeRequest(url, requestId);
    redirectListener({ url, redirectUrl, requestId });
  };
  send.rawRedirect = (url, redirectUrl, requestId, statusCode) => redirectListener({ url, redirectUrl, requestId, statusCode });
  send.headersReceived = (url, responseHeaders) => {
    send.beforeRequest(url);
    headersReceivedListener({ url, responseHeaders, requestId: "extension-request" });
  };
  send.stored = stored;
  send.action = action;
  send.installed = details => installedListener(details);
  send.openedTabs = openedTabs;
  return send;
}

test("opens private-browsing guidance only on first install", async () => {
  const send = loadBackground(async () => {});
  await send.installed({ reason: "install" });
  assert.equal(send.openedTabs.length, 1);
  assert.equal(send.openedTabs[0].url, "chrome-extension://test/welcome.html");
  await send.installed({ reason: "update" });
  assert.equal(send.openedTabs.length, 1);
});

test("uses a Location header even on Google's reported 402 response", async () => {
  const send = loadBackground(async () => ({
    status: 402,
    headers: new Headers({ location: "https://example.com/real-page" })
  }));
  const result = await send({
    type: "resolve-goto",
    url: "https://www.google.com/goto/opaque-key"
  });
  assert.equal(result.ok, true);
  assert.equal(result.url, "https://example.com/real-page");
});

test("shows a loading badge during a lookup and clears it after completion", async () => {
  let complete;
  const send = loadBackground(() => new Promise(resolve => { complete = resolve; }));
  const pending = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=loading" });
  while (!complete) await new Promise(resolve => setImmediate(resolve));
  assert.equal(send.action.text, "…");
  complete({ status: 302, headers: new Headers({ location: "https://example.com/page" }) });
  assert.equal((await pending).ok, true);
  assert.equal(send.action.text, "ON");
});

test("interactive lookups jump ahead of queued prefetches across tabs", async () => {
  const requests = [];
  let release;
  const send = loadBackground(async url => {
    requests.push(url);
    if (requests.length === 1) await new Promise(resolve => { release = resolve; });
    return { status: 302, headers: new Headers({ location: "https://example.com/page" }) };
  });
  const first = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=first", prefetch: true });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const second = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=background", prefetch: true });
  const urgent = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=urgent" });
  release();
  await Promise.all([first, second, urgent]);
  assert.deepEqual(requests.map(url => new URL(url).searchParams.get("url")), ["first", "urgent", "background"]);
});

test("a queued prefetch can be promoted when its link is hovered", async () => {
  const requests = [];
  let release;
  const send = loadBackground(async url => {
    requests.push(url);
    if (requests.length === 1) await new Promise(resolve => { release = resolve; });
    return { status: 302, headers: new Headers({ location: "https://example.com/page" }) };
  });
  const first = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=first" });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const other = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=other", prefetch: true });
  const promotedUrl = "https://www.google.com/goto?url=promoted";
  const promoted = send({ type: "resolve-goto", url: promotedUrl, prefetch: true });
  send.promote(promotedUrl);
  release();
  await Promise.all([first, other, promoted]);
  assert.deepEqual(requests.map(url => new URL(url).searchParams.get("url")), ["first", "promoted", "other"]);
});

test("queued interactive lookups are cancelled if the extension is disabled", async () => {
  let release;
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches++;
    await new Promise(resolve => { release = resolve; });
    return { status: 302, headers: new Headers({ location: "https://example.com/page" }) };
  });
  const first = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=first" });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const queued = send({ type: "resolve-goto", url: "https://www.google.com/goto?url=second" });
  send.stored.enabled = false;
  release();
  await first;
  assert.equal((await queued).ok, false);
  assert.equal(fetches, 1);
});

test("a 403 CAPTCHA on the ping route stops before /goto", async () => {
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches++;
    return { status: 403, type: "basic", headers: new Headers(), text: async () => 'unusual traffic' };
  });
  const result = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=x", pingUrl: "https://www.google.com/url?url=x" });
  assert.equal(result.ok, false);
  assert.ok(send.stored.pausedUntil > Date.now());
  assert.equal(fetches, 1);
});

test("uses the matching Google ping first and avoids a /goto request", async () => {
  const goto = "https://www.google.com/goto?url=shared-token";
  const ping = "https://www.google.com/url?sa=t&url=shared-token&ved=abc";
  const requests = [];
  const send = loadBackground(async (url) => {
    requests.push(url);
    if (url === goto) {
      return { status: 200, type: "basic", headers: new Headers() };
    }
    assert.equal(url, ping);
    return {
      status: 200,
      type: "basic",
      headers: new Headers({ "content-type": "text/html" }),
      async text() {
        return '<meta http-equiv="refresh" content="0;url=https://example.com/a&#38;b">';
      }
    };
  });
  const result = await send({ type: "resolve-goto", url: goto, pingUrl: ping });
  assert.equal(result.ok, true);
  assert.equal(result.url, "https://example.com/a&b");
  assert.deepEqual(requests, [ping]);
  assert.equal(send.stored.pausedUntil, undefined, "a successful fallback must not pause future lookups");
});

test("does not use a ping carrying a different opaque token", async () => {
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches += 1;
    return { status: 200, type: "basic", headers: new Headers() };
  });
  const result = await send({
    type: "resolve-goto",
    url: "https://www.google.com/goto?url=token-a",
    pingUrl: "https://www.google.com/url?url=token-b"
  });
  assert.equal(result.ok, false);
  assert.equal(fetches, 1, "only the original /goto request should run");
});

test("resolves a localized Google domain and rejects lookalikes", async () => {
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches++;
    return { status: 302, headers: new Headers({ location: "https://example.com/page" }) };
  });
  const valid = await send({ type: "resolve-goto", url: "https://www.google.co.uk/goto?url=x" });
  assert.equal(valid.url, "https://example.com/page");
  const invalid = await send({ type: "resolve-goto", url: "https://www.google.co.uk.evil.test/goto?url=x" });
  assert.equal(invalid.ok, false);
  assert.equal(fetches, 1);
});

for (const destination of [
  "https://cloud.google.com/docs",
  "https://support.google.com/mail/answer/1",
  "https://docs.google.com/document/d/x",
  "https://sites.google.com/sorry-not-sorry"
]) {
  test(`accepts legitimate Google destination ${destination}`, async () => {
    const send = loadBackground(async () => ({ status: 302, headers: new Headers({ location: destination }) }));
    const result = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=destination" });
    assert.equal(result.ok, true);
    assert.equal(result.url, destination);
    assert.equal(send.stored.pausedUntil, undefined);
  });
}

for (const destination of ["https://www.google.com/sorry", "https://www.google.co.uk/sorry/index"]) {
  test(`pauses on a Google verification path ${destination}`, async () => {
    const send = loadBackground(async () => ({ status: 302, headers: new Headers({ location: destination }) }));
    const result = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=challenge" });
    assert.equal(result.ok, false);
    assert.ok(send.stored.pausedUntil > Date.now());
  });
}

for (const destination of ["https://www.google.com/url?url=opaque", "https://www.google.com/goto?url=opaque", "https://consent.google.com/m"]) {
  test(`does not accept Google navigation or consent URL ${destination}`, async () => {
    const send = loadBackground(async () => ({ status: 302, headers: new Headers({ location: destination }) }));
    assert.equal((await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=x" })).ok, false);
  });
}

test("does not try /goto after a ping verification redirect", async () => {
  const source = "https://www.google.com/goto?url=flagged";
  const ping = "https://www.google.com/url?url=flagged";
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches++;
    setImmediate(() => send.redirect(ping, "https://www.google.com/sorry/index"));
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  const result = await send({ type: "resolve-goto", url: source, pingUrl: ping });
  assert.equal(result.ok, false);
  assert.equal(fetches, 1);
});

test("falls back to /goto when the ping has no destination", async () => {
  const goto = "https://www.google.com/goto?url=x";
  const ping = "https://www.google.com/url?url=x";
  const requests = [];
  const send = loadBackground(async (url) => {
    requests.push(url);
    return url === ping
      ? { status: 200, type: "basic", headers: new Headers(), text: async () => "unavailable" }
      : { status: 302, headers: new Headers({ location: "https://example.com/page" }) };
  });
  const result = await send({ type: "resolve-goto", url: goto, pingUrl: ping });
  assert.equal(result.url, "https://example.com/page");
  assert.deepEqual(requests, [ping, goto]);
});

test("stops prefetching when Google returns a CAPTCHA in a 200 response", async () => {
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches++;
    return { status: 200, type: "basic", headers: new Headers(), text: async () => '<div class="g-recaptcha"></div>' };
  });
  const result = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=x", pingUrl: "https://www.google.com/url?url=x" });
  assert.equal(result.ok, false);
  await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=next" });
  assert.equal(fetches, 1);
});

test("captures an opaque 3xx redirect without permission for its destination", async () => {
  const source = "https://www.google.com/goto?url=opaque-key";
  const send = loadBackground(async () => {
    setImmediate(() => send.redirect(source, "https://developers.openai.com/api/docs"));
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  const result = await send({ type: "resolve-goto", url: source });
  assert.equal(result.ok, true);
  assert.equal(result.url, "https://developers.openai.com/api/docs");
});

test("ignores unrelated browser redirects for the same Google URL", async () => {
  const source = "https://www.google.com/goto?url=collision";
  const send = loadBackground(async () => {
    setImmediate(() => {
      send.beforeRequest(source, "browser-request", "https://www.google.com", 7);
      send.rawRedirect(source, "https://www.google.com/sorry/index", "browser-request");
      send.beforeRequest(source, "extension-request");
      send.rawRedirect(source, "https://www.google.com/sorry/index", "browser-request");
      send.rawRedirect(source, "https://example.com/correct", "extension-request");
    });
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  const result = await send({ type: "resolve-goto", url: source });
  assert.equal(result.url, "https://example.com/correct");
  assert.equal(send.stored.pausedUntil, undefined);
});

test("uses Firefox originUrl and rejects absent or foreign request origins", async () => {
  const source = "https://www.google.com/goto?url=firefox-origin";
  const send = loadBackground(async () => {
    setImmediate(() => {
      send.rawBeforeRequest({ url: source, requestId: "missing", tabId: -1 });
      send.rawRedirect(source, "https://bad.example/", "missing");
      send.rawBeforeRequest({ url: source, requestId: "foreign", originUrl: "moz-extension://other/background.html", tabId: -1 });
      send.rawRedirect(source, "https://bad.example/", "foreign");
      send.rawBeforeRequest({ url: source, requestId: "correct", originUrl: "moz-extension://test/background.html", tabId: -1 });
      send.rawRedirect(source, "https://example.com/correct", "correct");
    });
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  }, "moz-extension://test");
  assert.equal((await send({ type: "resolve-goto", url: source })).url, "https://example.com/correct");
});

test("a 429 Location header pauses rather than resolving", async () => {
  const ping = "https://www.google.com/url?url=limited";
  let requests = 0;
  const send = loadBackground(async () => {
    requests++;
    setImmediate(() => {
      send.beforeRequest(ping);
      send.rawHeaders({ url: ping, requestId: "extension-request", statusCode: 429, responseHeaders: [{ name: "Location", value: "https://example.com/wrong" }] });
    });
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  const result = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=limited", pingUrl: ping });
  assert.equal(result.ok, false);
  assert.ok(send.stored.pausedUntil > Date.now());
  assert.equal(requests, 1);
});

test("a /goto 429 redirect event pauses rather than resolving", async () => {
  const source = "https://www.google.com/goto?url=limited";
  const send = loadBackground(async () => {
    setImmediate(() => {
      send.beforeRequest(source);
      send.rawRedirect(source, "https://example.com/wrong", "extension-request", 429);
    });
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  assert.equal((await send({ type: "resolve-goto", url: source })).ok, false);
  assert.ok(send.stored.pausedUntil > Date.now());
});

for (const route of ["goto", "ping"]) {
  test(`a readable ${route} 429 with Location pauses before accepting it`, async () => {
    let requests = 0;
    const send = loadBackground(async () => {
      requests++;
      return { status: 429, type: "basic", headers: new Headers({ location: "https://example.com/wrong" }) };
    });
    const message = { type: "resolve-goto", url: "https://www.google.com/goto?url=limited" };
    if (route === "ping") message.pingUrl = "https://www.google.com/url?url=limited";
    assert.equal((await send(message)).ok, false);
    assert.ok(send.stored.pausedUntil > Date.now());
    assert.equal(requests, 1);
  });
}

test("rejects a Google search page returned by Firefox's redirect headers", async () => {
  const source = "https://www.google.com/goto?url=firefox-key";
  const send = loadBackground(async () => {
    setImmediate(() => send.headersReceived(source, [
      { name: "Location", value: "/search?q=resolved" }
    ]));
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  const result = await send({ type: "resolve-goto", url: source });
  assert.equal(result.ok, false);
});

test("never returns Google's verification page and pauses further lookups", async () => {
  const source = "https://www.google.com/goto?url=flagged";
  let fetches = 0;
  const send = loadBackground(async () => {
    fetches += 1;
    setImmediate(() => send.redirect(source, "https://www.google.com/sorry/index?continue=x"));
    return { status: 0, type: "opaqueredirect", headers: new Headers() };
  });
  const flagged = await send({ type: "resolve-goto", url: source });
  assert.equal(flagged.ok, false);
  assert.equal(fetches, 1);

  const paused = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=next" });
  assert.equal(paused.ok, false);
  assert.equal(fetches, 1, "no request is sent while paused");

  send.stored.pausedUntil = Date.now() - 1;
  await send({ type: "resolve-goto", url: source });
  assert.equal(fetches, 2, "lookups resume after the pause");
});

for (const status of [200, 429]) {
  test(`leaves links unresolved on a ${status} response with no destination`, async () => {
    let fetches = 0;
    const send = loadBackground(async () => {
      fetches += 1;
      return { status, type: "basic", headers: new Headers() };
    });
    const result = await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=a" });
    assert.equal(result.ok, false);
    await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=b" });
    assert.equal(fetches, status === 429 ? 1 : 2);
  });
}

test("shows a red badge with the reason until a lookup succeeds", async () => {
  let response = { status: 200, type: "basic", headers: new Headers() };
  const send = loadBackground(async () => response);
  await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=a" });
  assert.equal(send.action.text, "!");
  assert.equal(send.action.color, "#d93025");
  assert.match(send.action.title, /did not return a redirect \(200\)/);

  await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=b" });
  assert.match(send.action.title, /\(200\)/);
  response = { status: 402, headers: new Headers({ location: "https://example.com/real" }) };
  await send({ type: "resolve-goto", url: "https://www.google.com/goto?url=c" });
  assert.equal(send.action.text, "ON");
  assert.equal(send.action.color, "#1a73e8");
});

test("will not turn the background worker into an arbitrary URL fetcher", async () => {
  let fetched = false;
  const send = loadBackground(async () => { fetched = true; });
  const result = await send({
    type: "resolve-goto",
    url: "https://example.com/goto/not-google"
  });
  assert.equal(result.ok, false);
  assert.equal(fetched, false);
});
