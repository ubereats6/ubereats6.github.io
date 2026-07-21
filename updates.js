(() => {
  const list = document.getElementById("updatesList");
  const status = document.getElementById("updatesStatus");
  if (!list) return;

  const typeLabels = {
    news: "最新消息",
    release: "工具更新",
    website: "網站更新",
    partner: "合作夥伴",
    notice: "公告",
    fix: "問題修正"
  };

  const formatDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? `${match[1]}/${match[2]}/${match[3]}` : value || "";
  };

  const render = (items) => {
    list.replaceChildren();

    items.slice(0, 3).forEach((item) => {
      const link = document.createElement("a");
      link.className = "update-card";
      link.href = item.link || "#";
      if (/^https?:\/\//i.test(item.link || "")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      const meta = document.createElement("div");
      meta.className = "update-meta";

      const tag = document.createElement("span");
      tag.className = `update-tag update-tag-${item.type || "notice"}`;
      tag.textContent = typeLabels[item.type] || "更新";

      const date = document.createElement("time");
      date.dateTime = item.date || "";
      date.textContent = formatDate(item.date);

      const title = document.createElement("h3");
      title.textContent = item.title || "未命名更新";

      const description = document.createElement("p");
      description.textContent = item.description || "";

      const arrow = document.createElement("span");
      arrow.className = "update-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";

      meta.append(tag, date);
      link.append(meta, title, description, arrow);
      list.append(link);
    });

    if (status) status.remove();
  };

  fetch("updates.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((items) => {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("No updates");
      }
      const sorted = [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      render(sorted);
    })
    .catch(() => {
      if (status) status.textContent = "目前沒有可顯示的更新資訊。";
    });
})();
