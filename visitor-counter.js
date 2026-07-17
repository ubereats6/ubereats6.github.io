(() => {
  const counter = document.getElementById("visitorCounter");
  const valueNode = document.getElementById("visitorCount");
  if (!counter || !valueNode) return;

  const namespace = "ubereats6-org";
  const key = "site-visits";
  const countedKey = "ubereats6VisitorCounted";
  const cachedCountKey = "ubereats6VisitorCount";
  const baseUrl = `https://api.counterapi.dev/v1/${namespace}/${key}`;

  const formatAndShow = (count) => {
    const number = Number(count);
    if (!Number.isFinite(number)) return false;
    valueNode.textContent = number.toLocaleString("zh-TW");
    counter.hidden = false;
    sessionStorage.setItem(cachedCountKey, String(number));
    return true;
  };

  const cachedCount = sessionStorage.getItem(cachedCountKey);
  if (cachedCount !== null) formatAndShow(cachedCount);

  const shouldIncrement = sessionStorage.getItem(countedKey) !== "1";
  const endpoint = shouldIncrement ? `${baseUrl}/up` : baseUrl;

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
      // If a value was already cached in this tab, keep displaying it.
      // Otherwise keep the footer clean while the external service is unavailable.
      if (sessionStorage.getItem(cachedCountKey) === null) counter.hidden = true;
    })
    .finally(() => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    });
})();
