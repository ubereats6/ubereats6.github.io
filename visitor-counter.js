(() => {
  const namespace = "ubereats6-org";
  const key = "site-visits";
  const countedKey = "ubereats6VisitorCounted";
  const cachedCountKey = "ubereats6VisitorCount";
  const baseUrl = `https://api.counterapi.dev/v1/${namespace}/${key}`;

  const getNodes = () => ({
    counter: document.getElementById("visitorCounter"),
    valueNode: document.getElementById("visitorCount")
  });

  const readCount = (payload) => {
    const candidates = [
      payload?.count,
      payload?.value,
      payload?.data?.count,
      payload?.data?.value,
      payload?.data?.up_count
    ];
    return candidates.find((item) => Number.isFinite(Number(item)));
  };

  const formatAndShow = (count) => {
    const { counter, valueNode } = getNodes();
    const number = Number(count);
    if (!counter || !valueNode || !Number.isFinite(number)) return false;

    valueNode.textContent = number.toLocaleString("zh-TW");
    counter.hidden = false;

    // localStorage survives normal page navigation and browser back/forward cache.
    localStorage.setItem(cachedCountKey, String(number));
    return true;
  };

  const showCachedCount = () => {
    const cached = localStorage.getItem(cachedCountKey);
    if (cached !== null) formatAndShow(cached);
  };

  const loadCount = () => {
    const { counter, valueNode } = getNodes();
    if (!counter || !valueNode) return;

    // Always restore the last known value immediately when Home is shown again.
    showCachedCount();

    // Increment only once per browser tab/session; subsequent Home visits only read.
    const shouldIncrement = sessionStorage.getItem(countedKey) !== "1";
    const endpoint = shouldIncrement ? `${baseUrl}/up` : baseUrl;

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    fetch(endpoint, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller?.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Counter API ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        const count = readCount(payload);
        if (count === undefined) throw new Error("Counter value missing");
        formatAndShow(count);
        if (shouldIncrement) sessionStorage.setItem(countedKey, "1");
      })
      .catch(() => {
        // Keep the cached value visible. Only hide when no value has ever been loaded.
        if (localStorage.getItem(cachedCountKey) === null) counter.hidden = true;
      })
      .finally(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });
  };

  // Normal navigation / reload.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadCount, { once: true });
  } else {
    loadCount();
  }

  // Browser Back/Forward Cache can restore the old DOM without rerunning scripts.
  // Re-show the cached value and refresh it whenever Home becomes visible again.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      showCachedCount();
      loadCount();
    }
  });
})();
