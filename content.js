(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const HOVER_DELAY_MS = 300;
  const originals = new Map();
  const cache = new Map();
  const queued = new Set();
  const queue = [];
  let enabled = false;
  let active = 0;
  let observer;
  let hoverTimer;

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

  // Requesting links unprompted gets users flagged by Google, so a scan only
  // applies destinations already known. New lookups wait for hover or focus.
  function applyKnown(anchor) {
    if (enabled && isGotoLink(anchor) && cache.has(anchor.href)) enqueue(anchor);
  }

  function scan(root = document) {
    if (root instanceof HTMLAnchorElement) applyKnown(root);
    root.querySelectorAll?.("a[href]").forEach(applyKnown);
  }

  function linkFromEvent(event) {
    const anchor = event.target.closest?.("a[href]");
    return anchor && isGotoLink(anchor) ? anchor : null;
  }

  function resolveSoon(event) {
    clearTimeout(hoverTimer);
    const anchor = linkFromEvent(event);
    if (anchor) hoverTimer = setTimeout(() => enqueue(anchor), HOVER_DELAY_MS);
  }

  function cancelResolve() {
    clearTimeout(hoverTimer);
  }

  function resolveNow(event) {
    const anchor = linkFromEvent(event);
    if (anchor) enqueue(anchor);
  }

  function drain() {
    while (enabled && active < 1 && queue.length) {
      const item = queue.shift();
      active += 1;
      api.runtime.sendMessage({ type: "resolve-goto", url: item.original })
        .then((result) => {
          if (!result?.ok || !result.url) return;
          cache.set(item.original, result.url);
          scan();
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
    document.addEventListener("pointerover", resolveSoon);
    document.addEventListener("pointerout", cancelResolve);
    document.addEventListener("focusin", resolveSoon);
    document.addEventListener("touchstart", resolveNow, { passive: true });
    document.addEventListener("contextmenu", resolveNow);
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
        if (mutation.type === "attributes") applyKnown(mutation.target);
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
    cancelResolve();
    document.removeEventListener("pointerover", resolveSoon);
    document.removeEventListener("pointerout", cancelResolve);
    document.removeEventListener("focusin", resolveSoon);
    document.removeEventListener("touchstart", resolveNow);
    document.removeEventListener("contextmenu", resolveNow);
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
