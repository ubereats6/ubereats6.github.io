(() => {
  const chapter = document.getElementById('chapterFilter');
  const boss = document.getElementById('bossFilter');
  const search = document.getElementById('mapSearch');
  const grid = document.getElementById('mapGrid');
  const count = document.getElementById('eggCount');
  const dialog = document.getElementById('mapDialog');
  const dialogChapter = document.getElementById('dialogChapter');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogImage = document.getElementById('dialogImage');
  const position = document.getElementById('dialogPosition');
  const previous = document.getElementById('prevMap');
  const next = document.getElementById('nextMap');
  let maps = [];
  let visible = [];
  let current = -1;
  let opener = null;

  function show(index) {
    if (index < 0 || index >= visible.length) return;
    current = index;
    const map = visible[index];
    dialogChapter.textContent = `第 ${map.chapter} 層 · ${map.boss ? '有 Boss' : '無 Boss'}`;
    dialogTitle.textContent = map.label;
    dialogImage.src = `maps/${map.file}`;
    dialogImage.alt = `第 ${map.chapter} 層 ${map.label}的完整地圖`;
    position.textContent = `${index + 1} / ${visible.length}`;
    previous.disabled = index === 0;
    next.disabled = index === visible.length - 1;
    dialog.querySelector('.egg-image-wrap').scrollTo(0, 0);
    if (!dialog.open) dialog.showModal();
  }

  function render() {
    const q = search.value.trim().toLocaleLowerCase('zh-Hant');
    visible = maps.filter(map =>
      (chapter.value === 'all' || String(map.chapter) === chapter.value) &&
      (boss.value === 'all' || map.boss === (boss.value === 'yes')) &&
      (!q || `${map.label} ${map.sourceName}`.toLocaleLowerCase('zh-Hant').includes(q))
    );
    count.textContent = `顯示 ${visible.length}／${maps.length} 張地圖`;
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'egg-empty';
      empty.textContent = '沒有符合的地圖，請調整篩選條件。';
      grid.replaceChildren(empty);
      return;
    }
    const cards = visible.map((map, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'egg-card';
      card.setAttribute('aria-label', `放大第 ${map.chapter} 層 ${map.label}地圖`);
      const preview = document.createElement('span');
      preview.className = 'egg-card-image';
      const image = document.createElement('img');
      image.src = `maps/${map.file}`;
      image.alt = '';
      image.loading = 'lazy';
      preview.append(image);
      const info = document.createElement('span');
      info.className = 'egg-card-info';
      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = map.label;
      const floor = document.createElement('small');
      floor.textContent = `第 ${map.chapter} 層`;
      text.append(name, floor);
      const tag = document.createElement('span');
      tag.className = 'egg-card-boss';
      tag.textContent = map.boss ? 'BOSS' : '無 BOSS';
      info.append(text, tag);
      card.append(preview, info);
      card.addEventListener('click', () => { opener = card; show(index); });
      return card;
    });
    grid.replaceChildren(...cards);
  }

  [chapter, boss, search].forEach(control => control.addEventListener(control === search ? 'input' : 'change', render));
  document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { opener?.focus(); });

  fetch('maps.json', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(data => { if (!Array.isArray(data)) throw new Error('無效地圖資料'); maps = data; render(); })
    .catch(() => { count.textContent = '讀取失敗'; grid.textContent = '地圖暫時無法載入，請稍後重新整理。'; });
})();
