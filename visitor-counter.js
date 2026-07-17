(() => {
  const counter = document.getElementById("visitorCounter");
  const valueNode = document.getElementById("visitorCount");
  if (!counter || !valueNode) return;

  const namespace = "ubereats6-org";
  const key = "site-visits";
  const sessionKey = "ubereats6VisitorCounted";
  const baseUrl = `https://api.counterapi.dev/v1/${namespace}/${key}`;
  const shouldIncrement = sessionStorage.getItem(sessionKey) !== "1";
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

  fetch(endpoint, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Counter API ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const count = readCount(payload);
      if (count === undefined) throw new Error("Counter value missing");
      valueNode.textContent = Number(count).toLocaleString("zh-TW");
      counter.hidden = false;
      if (shouldIncrement) sessionStorage.setItem(sessionKey, "1");
    })
    .catch(() => {
      // Keep the footer clean when the external counter service is unavailable.
      counter.hidden = true;
    });
})();
