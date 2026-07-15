const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector(".nav");

menuButton?.addEventListener("click", () => {
  const open = nav?.classList.toggle("open") ?? false;
  menuButton.setAttribute("aria-expanded", String(open));
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

const linkIcon = `
  <svg class="useful-link-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.59 13.41a1 1 0 0 1 0-1.41l3.18-3.18a3 3 0 1 1 4.24 4.24l-1.41 1.41a3 3 0 0 1-4.24 0 1 1 0 1 1 1.41-1.41 1 1 0 0 0 1.42 0l1.41-1.41a1 1 0 1 0-1.42-1.42l-3.18 3.18a1 1 0 0 1-1.41 0Zm2.82-2.82a1 1 0 0 1 0 1.41l-3.18 3.18a3 3 0 1 1-4.24-4.24l1.41-1.41a3 3 0 0 1 4.24 0 1 1 0 1 1-1.41 1.41 1 1 0 0 0-1.42 0L7.4 12.35a1 1 0 0 0 1.42 1.42L12 10.59a1 1 0 0 1 1.41 0Z"/>
  </svg>`;

async function loadUsefulLinks() {
  const list = document.getElementById("usefulLinksList");
  if (!list) return;

  try {
    const response = await fetch("links.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const links = await response.json();
    if (!Array.isArray(links) || links.length === 0) throw new Error("No links found");

    list.replaceChildren(...links.map((item, index) => {
      const article = document.createElement("article");
      article.className = "useful-link-card";

      const number = document.createElement("span");
      number.className = "useful-link-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const copy = document.createElement("div");
      copy.className = "useful-link-copy";

      const category = document.createElement("span");
      category.className = "useful-link-category";
      category.textContent = item.category ?? "LINK";

      const title = document.createElement("h3");
      title.textContent = item.title;

      const description = document.createElement("p");
      description.textContent = item.description ?? "";

      copy.append(category, title, description);

      const anchor = document.createElement("a");
      anchor.className = "useful-link-button";
      anchor.href = item.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.innerHTML = `OPEN LINK ${linkIcon}`;

      article.append(number, copy, anchor);
      return article;
    }));
  } catch (error) {
    console.error("Failed to load links.json", error);
    list.innerHTML = '<div class="links-error">無法載入 links.json。請透過 GitHub Pages 或本機伺服器預覽。</div>';
  }
}

loadUsefulLinks();

const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");
const musicToggleText = musicToggle?.querySelector(".music-toggle-text");
const MUSIC_STORAGE_KEY = "ubereats6MusicEnabled";
let musicWanted = localStorage.getItem(MUSIC_STORAGE_KEY) === "true";

if (bgMusic) bgMusic.volume = 0.20;

function renderMusicState(isPlaying) {
  if (!musicToggle) return;
  musicToggle.classList.toggle("is-playing", isPlaying);
  musicToggle.setAttribute("aria-pressed", String(isPlaying));
  musicToggle.setAttribute("aria-label", isPlaying ? "暫停背景音樂" : "播放背景音樂");
  if (musicToggleText) musicToggleText.textContent = isPlaying ? "MUSIC ON" : "MUSIC OFF";
}

async function playMusic() {
  if (!bgMusic) return;
  try {
    await bgMusic.play();
    musicWanted = true;
    localStorage.setItem(MUSIC_STORAGE_KEY, "true");
    renderMusicState(true);
  } catch {
    renderMusicState(false);
  }
}

function pauseMusic() {
  if (!bgMusic) return;
  bgMusic.pause();
  musicWanted = false;
  localStorage.setItem(MUSIC_STORAGE_KEY, "false");
  renderMusicState(false);
}

musicToggle?.addEventListener("click", () => {
  if (!bgMusic) return;
  if (bgMusic.paused) playMusic();
  else pauseMusic();
});

if (musicWanted) {
  const resumeOnce = () => playMusic();
  document.addEventListener("pointerdown", resumeOnce, { once: true });
  document.addEventListener("keydown", resumeOnce, { once: true });
}

renderMusicState(false);
