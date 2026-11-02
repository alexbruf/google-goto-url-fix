const googleHostnames = new Set(["www.google.ad","www.google.ae","www.google.al","www.google.am","www.google.as","www.google.at","www.google.az","www.google.ba","www.google.be","www.google.bf","www.google.bg","www.google.bi","www.google.bj","www.google.bs","www.google.bt","www.google.by","www.google.ca","www.google.cat","www.google.cd","www.google.cf","www.google.cg","www.google.ch","www.google.ci","www.google.cl","www.google.cm","www.google.cn","www.google.co","www.google.co.ao","www.google.co.bw","www.google.co.ck","www.google.co.cr","www.google.co.id","www.google.co.il","www.google.co.in","www.google.co.jp","www.google.co.ke","www.google.co.kr","www.google.co.ls","www.google.co.ma","www.google.co.mz","www.google.co.nz","www.google.co.th","www.google.co.tz","www.google.co.ug","www.google.co.uk","www.google.co.uz","www.google.co.ve","www.google.co.vi","www.google.co.za","www.google.co.zm","www.google.co.zw","www.google.com","www.google.com.af","www.google.com.ag","www.google.com.ai","www.google.com.ar","www.google.com.au","www.google.com.bd","www.google.com.bh","www.google.com.bn","www.google.com.bo","www.google.com.br","www.google.com.bz","www.google.com.co","www.google.com.cu","www.google.com.cy","www.google.com.do","www.google.com.ec","www.google.com.eg","www.google.com.et","www.google.com.fj","www.google.com.gh","www.google.com.gi","www.google.com.gt","www.google.com.hk","www.google.com.jm","www.google.com.kh","www.google.com.kw","www.google.com.lb","www.google.com.ly","www.google.com.mm","www.google.com.mt","www.google.com.mx","www.google.com.my","www.google.com.na","www.google.com.ng","www.google.com.ni","www.google.com.np","www.google.com.om","www.google.com.pa","www.google.com.pe","www.google.com.pg","www.google.com.ph","www.google.com.pk","www.google.com.pr","www.google.com.py","www.google.com.qa","www.google.com.sa","www.google.com.sb","www.google.com.sg","www.google.com.sl","www.google.com.sv","www.google.com.tj","www.google.com.tr","www.google.com.tw","www.google.com.ua","www.google.com.uy","www.google.com.vc","www.google.com.vn","www.google.cv","www.google.cz","www.google.de","www.google.dj","www.google.dk","www.google.dm","www.google.dz","www.google.ee","www.google.es","www.google.fi","www.google.fm","www.google.fr","www.google.ga","www.google.ge","www.google.gg","www.google.gl","www.google.gm","www.google.gr","www.google.gy","www.google.hn","www.google.hr","www.google.ht","www.google.hu","www.google.ie","www.google.im","www.google.iq","www.google.is","www.google.it","www.google.je","www.google.jo","www.google.kg","www.google.ki","www.google.kz","www.google.la","www.google.li","www.google.lk","www.google.lt","www.google.lu","www.google.lv","www.google.md","www.google.me","www.google.mg","www.google.mk","www.google.ml","www.google.mn","www.google.ms","www.google.mu","www.google.mv","www.google.mw","www.google.ne","www.google.nl","www.google.no","www.google.nr","www.google.nu","www.google.pl","www.google.pn","www.google.ps","www.google.pt","www.google.ro","www.google.rs","www.google.ru","www.google.rw","www.google.sc","www.google.se","www.google.sh","www.google.si","www.google.sk","www.google.sm","www.google.sn","www.google.so","www.google.sr","www.google.st","www.google.td","www.google.tg","www.google.tl","www.google.tm","www.google.tn","www.google.to","www.google.tt","www.google.vg","www.google.vu","www.google.ws"]);
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const HOVER_DELAY_MS = 300;
  const PREFETCH_DELAY_MS = 1000;
  const PREFETCH_GAP_MS = 1500;
  const PREFETCH_LIMIT = 4;
  const originals = new Map();
  const cache = new Map();
  const queued = new Set();
  const queue = [];
  let enabled = false;
  let active = 0;
  let activePrefetch = 0;
  let activeInteractive = 0;
  let observer;
  let hoverTimer;
  let focusTimer;
  let prefetchTimer;
  let drainTimer;
  let prefetchCount = 0;
  let prefetchEnabled = true;
  let nextPrefetchAt = 0;

  function isGotoLink(anchor) {
    try {
      const url = new URL(anchor.href);
      return googleHostnames.has(url.hostname) &&
        (url.pathname === "/goto" || url.pathname.startsWith("/goto/"));
    } catch {
      return false;
    }
  }

  function pingFor(anchor, gotoUrl) {
    const ping = anchor.getAttribute("ping");
    if (!ping) return null;
    const pingUrl = ping.trim().split(/\s+/).find((candidate) => {
      try {
        const url = new URL(candidate, location.href);
        return url.protocol === "https:" &&
          googleHostnames.has(url.hostname) &&
          url.pathname === "/url" &&
          url.searchParams.get("url") === new URL(gotoUrl).searchParams.get("url");
      } catch {
        return false;
      }
    });
    return pingUrl ? new URL(pingUrl, location.href).href : null;
  }

  // Only use direct, unambiguous destination attributes on this exact anchor.
  // Page-wide proximity is not enough to establish that two results match.
  function destinationOnAnchor(anchor) {
    const candidates = new Set();
    for (const name of ["data-rw", "data-target-url", "data-fburl", "data-lpage", "data-pcu", "data-vurl", "data-video-url", "data-url"]) {
      const value = anchor.getAttribute(name);
      if (!value) continue;
      for (const candidate of value.split(/,\s*(?=https?:\/\/)/i)) {
        try {
          const url = new URL(candidate.trim());
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
          const googleSearchHost = googleHostnames.has(url.hostname);
          const googleConsentHost = url.hostname.startsWith("consent.") && googleHostnames.has(url.hostname.slice("consent.".length));
          if ((googleSearchHost && /^\/(?:goto|url|search|sorry|recaptcha)(?:\/|$)/.test(url.pathname)) || googleConsentHost ||
              /(^|\.)(googleadservices\.com|googlesyndication\.com|doubleclick\.net|gstatic\.com|googleapis\.com|googleusercontent\.com)$/i.test(url.hostname)) continue;
          candidates.add(url.href);
        } catch {
          // Ignore opaque tokens, malformed values, and relative addresses.
        }
      }
    }
    return candidates.size === 1 ? [...candidates][0] : null;
  }

  function enqueue(anchor, prefetch = false) {
    if (!enabled || !anchor.isConnected || !isGotoLink(anchor)) return;
    const original = anchor.href;
    if (!originals.has(anchor)) originals.set(anchor, original);

    const onPage = destinationOnAnchor(anchor);
    if (onPage) {
      cache.set(original, onPage);
      anchor.href = onPage;
      return;
    }

    const cached = cache.get(original);
    if (cached) {
      anchor.href = cached;
      return;
    }
    if (queued.has(original)) {
      if (!prefetch) {
        const existing = queue.find(item => item.original === original);
        if (existing) { existing.prefetch = false; drain(); }
        else api.runtime.sendMessage({ type: "promote-goto", url: original }).catch(() => {});
      }
      return;
    }
    if (prefetch && prefetchCount >= PREFETCH_LIMIT) return;
    queued.add(original);
    const item = { anchor, original, pingUrl: pingFor(anchor, original), prefetch };
    if (prefetch) queue.push(item); else queue.unshift(item);
    drain();
  }

  // Resolve safe same-anchor data across the page without network requests.
  // Unknown links still wait for interaction or bounded nearby prefetch.
  function applyKnown(anchor) {
    if (enabled && isGotoLink(anchor) && (cache.has(anchor.href) || destinationOnAnchor(anchor))) enqueue(anchor);
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

  function resolveFocus(event) {
    clearTimeout(focusTimer);
    const anchor = linkFromEvent(event);
    if (anchor) focusTimer = setTimeout(() => enqueue(anchor), HOVER_DELAY_MS);
  }

  function cancelFocus() {
    clearTimeout(focusTimer);
  }

  function resolveNow(event) {
    const anchor = linkFromEvent(event);
    if (anchor) enqueue(anchor);
  }

  function clearPrefetchQueue() {
    for (let index = queue.length - 1; index >= 0; index--) {
      if (queue[index].prefetch) {
        queued.delete(queue[index].original);
        queue.splice(index, 1);
      }
    }
  }

  function schedulePrefetch() {
    clearTimeout(prefetchTimer);
    clearPrefetchQueue();
    if (!enabled || !prefetchEnabled) return;
    prefetchTimer = setTimeout(() => {
      if (!enabled || !prefetchEnabled || document.hidden) return;
      const anchors = [...document.querySelectorAll('a[href]')].filter(anchor => {
        if (!isGotoLink(anchor)) return false;
        const rect = anchor.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight + 200;
      });
      // Local values are free to resolve; network work remains strictly bounded.
      for (const anchor of anchors) {
        if (destinationOnAnchor(anchor)) enqueue(anchor, true);
      }
      for (const anchor of anchors.slice(0, 2)) enqueue(anchor, true);
    }, PREFETCH_DELAY_MS);
  }

  function drain() {
    while (enabled && active < 2 && queue.length) {
      const urgentIndex = queue.findIndex(item => !item.prefetch);
      if (urgentIndex >= 0 && activeInteractive === 0) {
        if (urgentIndex > 0) queue.unshift(queue.splice(urgentIndex, 1)[0]);
      } else if (activePrefetch > 0) {
        return;
      } else {
        const prefetchIndex = queue.findIndex(item => item.prefetch);
        if (prefetchIndex < 0) return;
        if (prefetchIndex > 0) queue.unshift(queue.splice(prefetchIndex, 1)[0]);
      }
      if (queue[0].prefetch && Date.now() < nextPrefetchAt) {
        clearTimeout(drainTimer);
        drainTimer = setTimeout(drain, nextPrefetchAt - Date.now());
        return;
      }
      const item = queue.shift();
      if (!item.anchor.isConnected || !isGotoLink(item.anchor)) {
        queued.delete(item.original);
        continue;
      }
      if (item.prefetch) {
        if (!prefetchEnabled || prefetchCount >= PREFETCH_LIMIT) {
          queued.delete(item.original);
          continue;
        }
        prefetchCount += 1;
        nextPrefetchAt = Date.now() + PREFETCH_GAP_MS;
      }
      active += 1;
      if (item.prefetch) activePrefetch += 1; else activeInteractive += 1;
      api.runtime.sendMessage({ type: "resolve-goto", url: item.original, pingUrl: item.pingUrl, prefetch: item.prefetch })
        .then((result) => {
          if (!result?.ok || !result.url) return;
          cache.set(item.original, result.url);
          scan();
        })
        .catch(() => {})
        .finally(() => {
          queued.delete(item.original);
          active -= 1;
          if (item.prefetch) activePrefetch -= 1; else activeInteractive -= 1;
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
    document.addEventListener("focusin", resolveFocus);
    document.addEventListener("focusout", cancelFocus);
    document.addEventListener("touchstart", resolveNow, { passive: true });
    document.addEventListener("contextmenu", resolveNow);
    window.addEventListener("scroll", schedulePrefetch, { passive: true });
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
      attributeFilter: ["href", "data-rw", "data-target-url", "data-fburl", "data-lpage", "data-pcu", "data-vurl", "data-video-url", "data-url"]
    });
    drain();
    schedulePrefetch();
  }

  function stop() {
    enabled = false;
    cancelResolve();
    cancelFocus();
    clearTimeout(prefetchTimer);
    clearTimeout(drainTimer);
    document.removeEventListener("pointerover", resolveSoon);
    document.removeEventListener("pointerout", cancelResolve);
    document.removeEventListener("focusin", resolveFocus);
    document.removeEventListener("focusout", cancelFocus);
    document.removeEventListener("touchstart", resolveNow);
    document.removeEventListener("contextmenu", resolveNow);
    window.removeEventListener("scroll", schedulePrefetch);
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

  api.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local" || !changes.prefetchNearby) return;
    prefetchEnabled = changes.prefetchNearby.newValue !== false;
    schedulePrefetch();
  });

  api.storage.local.get(["enabled", "prefetchNearby"]).then(({ enabled: initial, prefetchNearby }) => {
    prefetchEnabled = prefetchNearby !== false;
    if (initial === true) start();
  });
})();
