// Measures how much work content.js does on a page that changes constantly.
// Loaded before content.js so the counters wrap the APIs it uses.
(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "churn";
  const RESULTS = 100;
  const stats = { observerMs: 0, observerCalls: 0, extensionHrefWrites: 0, pageHrefWrites: 0, anchorsVisited: 0, lookups: 0 };
  let pageWriting = false;

  // Time every MutationObserver callback the content script registers.
  const NativeObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super((records, observer) => {
        const started = performance.now();
        try { callback(records, observer); } finally {
          stats.observerMs += performance.now() - started;
          stats.observerCalls += 1;
        }
      });
    }
  };
  const pageObserver = (callback) => new NativeObserver(callback);

  const hrefSetter = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").set;
  Object.defineProperty(HTMLAnchorElement.prototype, "href", {
    ...Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href"),
    set(value) {
      if (pageWriting) stats.pageHrefWrites += 1; else stats.extensionHrefWrites += 1;
      hrefSetter.call(this, value);
    }
  });

  for (const proto of [Document.prototype, Element.prototype]) {
    const native = proto.querySelectorAll;
    proto.querySelectorAll = function (selector) {
      const found = native.call(this, selector);
      if (selector.includes("a[href]")) stats.anchorsVisited += found.length;
      return found;
    };
  }

  globalThis.chrome = {
    storage: { local: { get: async () => ({ enabled: true, prefetchNearby: true }) }, onChanged: { addListener() {} } },
    runtime: {
      onMessage: { addListener() {} },
      async sendMessage(message) {
        if (message.type !== "resolve-goto") return { ok: true };
        stats.lookups += 1;
        await new Promise(resolve => setTimeout(resolve, 20));
        return { ok: true, url: `https://example.com/${new URL(message.url).searchParams.get("url")}` };
      }
    }
  };

  function gotoAnchor(token, local) {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", `https://www.google.com/goto?url=${token}`);
    if (local) anchor.setAttribute("data-target-url", `https://example.org/${token}`);
    anchor.textContent = `Result ${token}`;
    return anchor;
  }

  function buildResults() {
    const list = document.querySelector("#results");
    for (let i = 0; i < RESULTS; i++) {
      const item = document.createElement("li");
      // Half carry their destination on the anchor, so they resolve without a lookup.
      item.append(gotoAnchor(`r${i}`, i % 2 === 0));
      list.append(item);
    }
  }

  // Google re-rendering a result: put its /goto address back shortly after a rewrite.
  function startReverting() {
    const originals = new WeakMap();
    document.querySelectorAll("#results a").forEach(anchor => originals.set(anchor, anchor.getAttribute("href")));
    pageObserver((records) => {
      for (const record of records) {
        const anchor = record.target;
        const original = originals.get(anchor);
        if (!original || anchor.getAttribute("href") === original) continue;
        setTimeout(() => { pageWriting = true; anchor.href = original; pageWriting = false; }, 0);
      }
    }).observe(document.querySelector("#results"), { subtree: true, attributes: true, attributeFilter: ["href"] });
  }

  // A streaming answer: small chunks of text plus the odd link, every frame.
  function startChurn() {
    const stream = document.querySelector("#stream");
    let chunk = 0;
    const timer = setInterval(() => {
      const block = document.createElement("div");
      for (let i = 0; i < 20; i++) block.append(document.createElement("span"));
      if (chunk % 10 === 0) block.append(gotoAnchor(`s${chunk}`, false));
      stream.append(block);
      chunk += 1;
    }, 16);
    setTimeout(() => clearInterval(timer), 2000);
  }

  buildResults();
  if (mode === "revert") startReverting();
  if (mode === "churn") startChurn();

  globalThis.stress = {
    mode,
    snapshot: () => ({ mode, ...stats, observerMs: Math.round(stats.observerMs) })
  };
})();
