(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const originals = new Map();
  const cache = new Map();
  const queued = new Set();
  const queue = [];
  let enabled = false;
  let active = 0;
  let observer;

  function isGotoLink(anchor) {
    try {
      const url = new URL(anchor.href);
      return (url.hostname === "google.com" || url.hostname === "www.google.com") &&
        (url.pathname === "/goto" || url.pathname.startsWith("/goto/"));
    } catch {
      return false;
    }
  }

  function enqueue(anchor) {
    if (!enabled || !anchor.isConnected || !isGotoLink(anchor)) return;
    const original = anchor.href;
    if (!originals.has(anchor)) originals.set(anchor, original);

    const cached = cache.get(original);
    if (cached) {
      anchor.href = cached;
      return;
    }
    if (queued.has(original)) return;
    queued.add(original);
    queue.push({ anchor, original });
    drain();
  }

  function scan(root = document) {
    if (root instanceof HTMLAnchorElement) enqueue(root);
    root.querySelectorAll?.("a[href]").forEach(enqueue);
  }

  function drain() {
    while (enabled && active < 3 && queue.length) {
      const item = queue.shift();
      active += 1;
      api.runtime.sendMessage({ type: "resolve-goto", url: item.original })
        .then((result) => {
          if (!result?.ok || !result.url) return;
          cache.set(item.original, result.url);
          for (const [anchor, original] of originals) {
            if (enabled && original === item.original && anchor.isConnected) {
              anchor.href = result.url;
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          queued.delete(item.original);
          active -= 1;
          drain();
        });
    }
  }

  function start() {
    if (enabled) return;
    enabled = true;
    scan();
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
        if (mutation.type === "attributes") enqueue(mutation.target);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"]
    });
    drain();
  }

  function stop() {
    enabled = false;
    observer?.disconnect();
    observer = undefined;
    queue.length = 0;
    queued.clear();
    for (const [anchor, original] of originals) {
      if (anchor.isConnected) anchor.href = original;
    }
    originals.clear();
  }

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "set-enabled") message.enabled ? start() : stop();
  });

  api.storage.local.get("enabled").then(({ enabled: initial }) => {
    if (initial === true) start();
  });
})();
