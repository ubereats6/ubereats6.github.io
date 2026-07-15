const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector(".nav");

menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});

nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});


const featuredKart = document.getElementById("featuredKart");
const featuredKartName = document.getElementById("featuredKartName");

let kartSlides = [];
let kartDots = [];
let currentKart = 0;
let kartTimer = null;
const KART_INTERVAL_MS = 5000;

function showKart(index) {
  if (kartSlides.length === 0) return;

  currentKart = (index + kartSlides.length) % kartSlides.length;

  kartSlides.forEach((slide, slideIndex) => {
    const active = slideIndex === currentKart;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });

  kartDots.forEach((dot, dotIndex) => {
    const active = dotIndex === currentKart;
    dot.classList.toggle("active", active);
    dot.setAttribute("aria-current", active ? "true" : "false");
  });

  featuredKartName.textContent = kartSlides[currentKart].dataset.name;
}

function stopKartRotation() {
  if (kartTimer !== null) {
    window.clearInterval(kartTimer);
    kartTimer = null;
  }
}

function startKartRotation() {
  stopKartRotation();
  if (kartSlides.length <= 1) return;

  kartTimer = window.setInterval(() => {
    showKart(currentKart + 1);
  }, KART_INTERVAL_MS);
}

function createKartCarousel(karts) {
  const dotsContainer = featuredKart.querySelector(".kart-dots");
  featuredKart.querySelectorAll(".kart-slide, .kart-loading, .kart-error").forEach((node) => node.remove());
  dotsContainer.replaceChildren();

  kartSlides = karts.map((kart, index) => {
    const image = document.createElement("img");
    image.className = `kart-slide${index === 0 ? " active" : ""}`;
    image.src = kart.image;
    image.alt = kart.alt || `${kart.name} 封面圖`;
    image.dataset.name = kart.name;
    image.decoding = "async";
    image.setAttribute("aria-hidden", String(index !== 0));
    featuredKart.insertBefore(image, featuredKart.querySelector(".cover-overlay"));
    return image;
  });

  kartDots = karts.map((kart, index) => {
    const dot = document.createElement("button");
    dot.className = `kart-dot${index === 0 ? " active" : ""}`;
    dot.type = "button";
    dot.setAttribute("aria-label", `顯示${kart.name}`);
    dot.setAttribute("aria-current", index === 0 ? "true" : "false");
    dot.addEventListener("click", () => {
      showKart(index);
      startKartRotation();
    });
    dotsContainer.append(dot);
    return dot;
  });

  dotsContainer.hidden = karts.length <= 1;
  showKart(0);
  startKartRotation();
}

async function loadFeaturedKarts() {
  if (!featuredKart) return;

  try {
    const response = await fetch("karts.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const karts = await response.json();
    const validKarts = Array.isArray(karts)
      ? karts.filter((kart) => kart && kart.name && kart.image)
      : [];

    if (validKarts.length === 0) throw new Error("No valid karts found");
    createKartCarousel(validKarts);
  } catch (error) {
    console.error("Failed to load karts.json", error);
    featuredKart.querySelector(".kart-loading")?.remove();

    const message = document.createElement("div");
    message.className = "kart-error";
    message.textContent = "無法載入 karts.json";
    featuredKart.prepend(message);
    featuredKartName.textContent = "LOAD ERROR";
  }
}

featuredKart?.addEventListener("mouseenter", stopKartRotation);
featuredKart?.addEventListener("mouseleave", startKartRotation);
featuredKart?.addEventListener("focusin", stopKartRotation);
featuredKart?.addEventListener("focusout", startKartRotation);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopKartRotation();
  else startKartRotation();
});

loadFeaturedKarts();

async function loadCurrentGames() {
  const grid = document.getElementById("gameGrid");
  if (!grid) return;

  grid.innerHTML = '<div class="game-loading">Loading games…</div>';

  try {
    const response = await fetch("games.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const games = await response.json();
    if (!Array.isArray(games) || games.length === 0) {
      throw new Error("No games found");
    }

    grid.replaceChildren(...games.map((game) => {
      const card = document.createElement("article");
      card.className = `game-card ${game.accent === "kart" ? "kart-game" : "spirit-game"}`;

      const thumb = document.createElement("div");
      thumb.className = `game-thumb${game.image ? "" : " placeholder"}`;

      if (game.image) {
        const image = document.createElement("img");
        image.src = game.image;
        image.alt = `${game.name} 遊戲縮圖`;
        image.loading = "lazy";
        thumb.append(image);
      } else {
        thumb.textContent = game.name.slice(0, 2).toUpperCase();
      }

      const content = document.createElement("div");
      content.className = "game-card-content";

      const tag = document.createElement("span");
      tag.className = "game-tag";
      tag.textContent = game.tag ?? "CURRENT GAME";

      const title = document.createElement("h3");
      title.textContent = game.name;

      const description = document.createElement("p");
      description.textContent = game.description ?? "";

      content.append(tag, title, description);
      card.append(thumb, content);
      return card;
    }));
  } catch (error) {
    console.error("Failed to load games.json", error);
    grid.innerHTML = '<div class="game-error">無法載入 games.json。請透過 GitHub Pages 或本機伺服器預覽網站。</div>';
  }
}

loadCurrentGames();


// Background music: starts only after a user action to comply with browser autoplay rules.
const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");
const musicToggleText = musicToggle?.querySelector(".music-toggle-text");
const MUSIC_STORAGE_KEY = "ubereats6MusicEnabled";
let musicWanted = localStorage.getItem(MUSIC_STORAGE_KEY) === "true";
let pausedByVisibility = false;

if (bgMusic) {
  bgMusic.volume = 0.20;
}

function renderMusicState(isPlaying) {
  if (!musicToggle) return;
  musicToggle.classList.toggle("is-playing", isPlaying);
  musicToggle.setAttribute("aria-pressed", String(isPlaying));
  musicToggle.setAttribute("aria-label", isPlaying ? "暫停背景音樂" : "播放背景音樂");
  if (musicToggleText) musicToggleText.textContent = isPlaying ? "MUSIC ON" : "MUSIC OFF";
}

async function playMusic() {
  if (!bgMusic) return false;
  try {
    await bgMusic.play();
    musicWanted = true;
    localStorage.setItem(MUSIC_STORAGE_KEY, "true");
    renderMusicState(true);
    return true;
  } catch (error) {
    console.info("Background music is waiting for a user interaction.", error);
    renderMusicState(false);
    return false;
  }
}

function pauseMusic({ remember = true } = {}) {
  if (!bgMusic) return;
  bgMusic.pause();
  if (remember) {
    musicWanted = false;
    localStorage.setItem(MUSIC_STORAGE_KEY, "false");
  }
  renderMusicState(false);
}

musicToggle?.addEventListener("click", async () => {
  if (!bgMusic) return;
  if (bgMusic.paused) await playMusic();
  else pauseMusic();
});

// If music was enabled previously, resume on the first interaction of this visit.
if (musicWanted) {
  const resumeOnce = async () => {
    await playMusic();
    document.removeEventListener("pointerdown", resumeOnce);
    document.removeEventListener("keydown", resumeOnce);
  };
  document.addEventListener("pointerdown", resumeOnce, { once: true });
  document.addEventListener("keydown", resumeOnce, { once: true });
}

renderMusicState(false);

document.addEventListener("visibilitychange", () => {
  if (!bgMusic) return;
  if (document.hidden && !bgMusic.paused) {
    pausedByVisibility = true;
    bgMusic.pause();
    renderMusicState(false);
  } else if (!document.hidden && pausedByVisibility && musicWanted) {
    pausedByVisibility = false;
    playMusic();
  }
});
