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
  assert.ok(manifest.content_scripts[0].matches.every((match) => match.includes("google.com/search")));
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
});

test("browser-specific manifests keep the same narrow scope", () => {
  for (const browser of ["firefox", "safari"]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests", `${browser}.json`), "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, packageVersion);
    assert.deepEqual(Array.from(manifest.permissions), ["storage", "webRequest"]);
    assert.ok(manifest.host_permissions.every((match) => match.includes("google.com")));
    assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  }
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

function loadBackground(fetchImpl) {
  let messageListener;
  let redirectListener;
  const noOpEvent = { addListener() {} };
  const context = {
    URL,
    fetch: fetchImpl,
    chrome: {
      storage: { local: { get: async () => ({ enabled: false }), set: async () => {} } },
      action: {
        setBadgeText: async () => {},
        setBadgeBackgroundColor: async () => {},
        setTitle: async () => {},
        onClicked: noOpEvent
      },
      runtime: {
        onInstalled: noOpEvent,
        onStartup: noOpEvent,
        onMessage: { addListener(listener) { messageListener = listener; } }
      },
      webRequest: {
        onBeforeRedirect: { addListener(listener) { redirectListener = listener; } }
      },
      tabs: { sendMessage: async () => {} }
    },
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "background.js"), "utf8"),
    context
  );
  const send = (message) => new Promise((resolve) => messageListener(message, {}, resolve));
  send.redirect = (url, redirectUrl) => redirectListener({ url, redirectUrl });
  return send;
}

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
