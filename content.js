const googleHostnames = new Set(["google.ad","google.ae","google.al","google.am","google.as","google.at","google.az","google.ba","google.be","google.bf","google.bg","google.bi","google.bj","google.bs","google.bt","google.by","google.ca","google.cat","google.cd","google.cf","google.cg","google.ch","google.ci","google.cl","google.cm","google.cn","google.co","google.co.ao","google.co.bw","google.co.ck","google.co.cr","google.co.id","google.co.il","google.co.in","google.co.jp","google.co.ke","google.co.kr","google.co.ls","google.co.ma","google.co.mz","google.co.nz","google.co.th","google.co.tz","google.co.ug","google.co.uk","google.co.uz","google.co.ve","google.co.vi","google.co.za","google.co.zm","google.co.zw","google.com","google.com.af","google.com.ag","google.com.ai","google.com.ar","google.com.au","google.com.bd","google.com.bh","google.com.bn","google.com.bo","google.com.br","google.com.bz","google.com.co","google.com.cu","google.com.cy","google.com.do","google.com.ec","google.com.eg","google.com.et","google.com.fj","google.com.gh","google.com.gi","google.com.gt","google.com.hk","google.com.jm","google.com.kh","google.com.kw","google.com.lb","google.com.ly","google.com.mm","google.com.mt","google.com.mx","google.com.my","google.com.na","google.com.ng","google.com.ni","google.com.np","google.com.om","google.com.pa","google.com.pe","google.com.pg","google.com.ph","google.com.pk","google.com.pr","google.com.py","google.com.qa","google.com.sa","google.com.sb","google.com.sg","google.com.sl","google.com.sv","google.com.tj","google.com.tr","google.com.tw","google.com.ua","google.com.uy","google.com.vc","google.com.vn","google.cv","google.cz","google.de","google.dj","google.dk","google.dm","google.dz","google.ee","google.es","google.fi","google.fm","google.fr","google.ga","google.ge","google.gg","google.gl","google.gm","google.gr","google.gy","google.hn","google.hr","google.ht","google.hu","google.ie","google.im","google.iq","google.is","google.it","google.je","google.jo","google.kg","google.ki","google.kz","google.la","google.li","google.lk","google.lt","google.lu","google.lv","google.md","google.me","google.mg","google.mk","google.ml","google.mn","google.ms","google.mu","google.mv","google.mw","google.ne","google.nl","google.no","google.nr","google.nu","google.pl","google.pn","google.ps","google.pt","google.ro","google.rs","google.ru","google.rw","google.sc","google.se","google.sh","google.si","google.sk","google.sm","google.sn","google.so","google.sr","google.st","google.td","google.tg","google.tl","google.tm","google.tn","google.to","google.tt","google.vg","google.vu","google.ws"]);
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
      return googleHostnames.has(url.hostname.replace(/^www\./, "")) &&
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
          googleHostnames.has(url.hostname.replace(/^www\./, "")) &&
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
          const googleSearchHost = googleHostnames.has(url.hostname.replace(/^www\./, ""));
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
