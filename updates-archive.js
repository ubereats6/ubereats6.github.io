(() => {
  const list = document.getElementById("archiveList");
  const status = document.getElementById("archiveStatus");
  const yearFilter = document.getElementById("yearFilter");
  const loadMore = document.getElementById("archiveLoadMore");
  const complete = document.getElementById("archiveComplete");
  const summary = document.getElementById("archiveSummary");
  if (!list || !yearFilter || !loadMore) return;

  const PAGE_SIZE = 10;
  const typeLabels = {
    news: "最新消息",
    release: "工具更新",
    website: "網站更新",
    partner: "合作夥伴",
    notice: "公告",
    fix: "問題修正"
  };

  let allItems = [];
  let activeYear = "all";
  let visibleCount = PAGE_SIZE;

  const formatDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? `${match[1]}/${match[2]}/${match[3]}` : value || "";
  };

  const getYear = (item) => String(item.date || "").slice(0, 4);

  const filteredItems = () => activeYear === "all"
    ? allItems
    : allItems.filter((item) => getYear(item) === activeYear);

  const createCard = (item) => {
    const link = document.createElement("a");
    link.className = "archive-update-card";
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

    const content = document.createElement("div");
    content.className = "archive-update-content";

    const title = document.createElement("h3");
    title.textContent = item.title || "未命名更新";

    const description = document.createElement("p");
    description.textContent = item.description || "";

    const arrow = document.createElement("span");
    arrow.className = "update-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    meta.append(tag, date);
    content.append(title, description);
    link.append(meta, content, arrow);
    return link;
  };

  const renderYears = () => {
    const years = [...new Set(allItems.map(getYear).filter((year) => /^\d{4}$/.test(year)))]
      .sort((a, b) => Number(b) - Number(a));

    yearFilter.replaceChildren();
    [{ value: "all", label: "全部" }, ...years.map((year) => ({ value: year, label: year }))]
      .forEach(({ value, label }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "year-filter-button";
        button.textContent = label;
        button.dataset.year = value;
        button.setAttribute("aria-pressed", String(value === activeYear));
        button.addEventListener("click", () => {
          activeYear = value;
          visibleCount = PAGE_SIZE;
          renderYears();
          renderItems();
        });
        yearFilter.append(button);
      });
  };

  const renderItems = () => {
    const filtered = filteredItems();
    const visible = filtered.slice(0, visibleCount);
    list.replaceChildren(...visible.map(createCard));

    const yearLabel = activeYear === "all" ? "全部年份" : `${activeYear} 年`;
    if (summary) summary.textContent = `${yearLabel}共有 ${filtered.length} 筆更新，目前顯示 ${visible.length} 筆。`;

    const hasMore = visible.length < filtered.length;
    loadMore.hidden = !hasMore;
    complete.hidden = hasMore || filtered.length === 0;

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "updates-status";
      empty.textContent = "這個年份目前沒有更新資訊。";
      list.append(empty);
    }
  };

  loadMore.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderItems();
  });

  fetch("updates.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((items) => {
      if (!Array.isArray(items)) throw new Error("Invalid updates data");
      allItems = [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      if (status) status.remove();
      renderYears();
      renderItems();
    })
    .catch(() => {
      if (status) status.textContent = "目前無法載入更新紀錄，請稍後再試。";
      if (summary) summary.textContent = "更新資料載入失敗。";
    });
})();
