(() => {
  const runtimeListeners = [];
  const destinations = new Map([
    ["https://www.google.com/goto?url=fixture-main", "https://example.com/resolved-main"],
    ["https://www.google.com/goto?url=fixture-dynamic", "https://example.org/resolved-dynamic"]
  ]);

  globalThis.chrome = {
    storage: { local: { get: async () => ({ enabled: true }) } },
    runtime: {
      onMessage: { addListener(listener) { runtimeListeners.push(listener); } },
      async sendMessage(message) {
        const url = destinations.get(message.url);
        return url ? { ok: true, url } : { ok: false, error: "Unknown fixture URL" };
      }
    }
  };

  globalThis.fixture = {
    setEnabled(enabled) {
      runtimeListeners.forEach((listener) => listener({ type: "set-enabled", enabled }));
    },
    addDynamicResult() {
      const item = document.createElement("li");
      item.innerHTML = '<a id="dynamic-link" href="https://www.google.com/goto?url=fixture-dynamic">Dynamic Google result</a>';
      document.querySelector("#results").append(item);
    },
    snapshot() {
      return {
        main: document.querySelector("#goto-link").href,
        normal: document.querySelector("#normal-link").href,
        dynamic: document.querySelector("#dynamic-link")?.href ?? null
      };
    }
  };

  window.addEventListener("load", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.querySelector("#status").textContent = "Fixture ready";
  });
})();
