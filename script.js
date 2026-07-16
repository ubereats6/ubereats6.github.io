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
const KART_INTERVAL_MS = 6500;

function showKart(index) {
  if (kartSlides.length === 0) return;

  currentKart = (index + kartSlides.length) % kartSlides.length;

  kartSlides.forEach((slide, slideIndex) => {
    const active = slideIndex === currentKart;
    slide.classList.remove("active", "zooming");
    slide.setAttribute("aria-hidden", String(!active));
  });

  const activeSlide = kartSlides[currentKart];
  activeSlide.classList.add("active");

  // Two animation frames ensure mobile Safari paints the starting scale first.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => activeSlide.classList.add("zooming"));
  });

  kartDots.forEach((dot, dotIndex) => {
    const active = dotIndex === currentKart;
    dot.classList.toggle("active", active);
    dot.setAttribute("aria-current", active ? "true" : "false");
  });

  featuredKartName.textContent = activeSlide.dataset.name;
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
const nowPlaying = document.getElementById("nowPlaying");
const nowPlayingStatus = document.getElementById("nowPlayingStatus");
const MUSIC_STORAGE_KEY = "ubereats6MusicEnabled";
let musicWanted = localStorage.getItem(MUSIC_STORAGE_KEY) === "true";
let pausedByVisibility = false;
let nowPlayingHideTimer = null;
let utilityStackTimer = null;

if (bgMusic) {
  bgMusic.volume = 0.20;
}

function renderMusicState(isPlaying, { silent = false } = {}) {
  if (!musicToggle) return;

  window.clearTimeout(nowPlayingHideTimer);
  window.clearTimeout(utilityStackTimer);

  const isMobileLayout = window.matchMedia("(max-width: 780px)").matches;

  musicToggle.classList.toggle("is-playing", isPlaying);
  musicToggle.setAttribute("aria-pressed", String(isPlaying));
  musicToggle.setAttribute("aria-label", isPlaying ? "暫停背景音樂" : "播放背景音樂");
  if (musicToggleText) musicToggleText.textContent = isPlaying ? "MUSIC ON" : "MUSIC OFF";
  nowPlaying?.classList.toggle("is-playing", isPlaying);
  if (nowPlayingStatus) nowPlayingStatus.textContent = isPlaying ? "PLAYING" : "PAUSED";

  if (silent) {
    nowPlaying?.classList.remove("is-visible", "is-hiding");
    document.body.classList.remove("now-playing-active");
    return;
  }

  nowPlaying?.classList.remove("is-hiding");
  nowPlaying?.classList.add("is-visible");
  document.body.classList.add("now-playing-active");

  if (isPlaying && !isMobileLayout) return;

  const visibleTime = isPlaying ? 2200 : 1000;
  nowPlayingHideTimer = window.setTimeout(() => {
    const stateStillMatches = isPlaying ? !bgMusic?.paused : bgMusic?.paused;
    if (!stateStillMatches) return;

    nowPlaying?.classList.add("is-hiding");

    utilityStackTimer = window.setTimeout(() => {
      const stillMatches = isPlaying ? !bgMusic?.paused : bgMusic?.paused;
      if (!stillMatches) return;
      nowPlaying?.classList.remove("is-visible", "is-hiding");
      document.body.classList.remove("now-playing-active");
    }, 460);
  }, visibleTime);
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
    renderMusicState(false, { silent: true });
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
  else {
    pauseMusic();
  }
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




const PEOPLE_LINK_ICON_PATH = "M10.59 13.41a1 1 0 0 1 0-1.41l3.18-3.18a3 3 0 1 1 4.24 4.24l-1.41 1.41a3 3 0 0 1-4.24 0 1 1 0 1 1 1.41-1.41 1 1 0 0 0 1.42 0l1.41-1.41a1 1 0 1 0-1.42-1.42l-3.18 3.18a1 1 0 0 1-1.41 0Zm2.82-2.82a1 1 0 0 1 0 1.41l-3.18 3.18a3 3 0 1 1-4.24-4.24l1.41-1.41a3 3 0 0 1 4.24 0 1 1 0 1 1-1.41 1.41 1 1 0 0 0-1.42 0L7.4 12.35a1 1 0 0 0 1.42 1.42L12 10.59a1 1 0 0 1 1.41 0Z";

function createPersonCard(person) {
  const card = document.createElement("article");
  card.className = ["person-card", "compact-card", person.className || ""]
    .filter(Boolean)
    .join(" ");

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "avatar-wrap";

  const image = document.createElement("img");
  image.src = person.image;
  image.alt = person.alt || `${person.name} 的頭像`;
  image.loading = "lazy";
  image.decoding = "async";
  avatarWrap.append(image);

  const statusRing = document.createElement("span");
  statusRing.className = `status-ring${person.online === false ? "" : " online"}`;
  avatarWrap.append(statusRing);

  const title = document.createElement("h3");
  title.textContent = person.name;

  const bio = document.createElement("p");
  bio.className = "person-bio";
  const descriptionLines = Array.isArray(person.description)
    ? person.description.filter(Boolean)
    : [person.description].filter(Boolean);

  descriptionLines.forEach((line, index) => {
    bio.append(document.createTextNode(line));
    if (index < descriptionLines.length - 1) {
      const desktopBreak = document.createElement("span");
      desktopBreak.className = "desktop-break";
      desktopBreak.append(document.createElement("br"));
      bio.append(desktopBreak);
    }
  });

  card.append(avatarWrap, title, bio);

  if (typeof person.url === "string" && person.url.trim()) {
    const link = document.createElement("a");
    link.href = person.url.trim();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.append(document.createTextNode(person.linkLabel || "Link"));

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "share-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", PEOPLE_LINK_ICON_PATH);
    icon.append(path);
    link.append(icon);
    card.append(link);
  } else {
    const noLink = document.createElement("span");
    noLink.className = "profile-status";
    noLink.textContent = "No public link";
    card.append(noLink);
  }

  return card;
}

async function loadPeople() {
  const grid = document.getElementById("peopleGrid");
  if (!grid) return;

  try {
    const response = await fetch("partners.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const people = await response.json();
    const validPeople = Array.isArray(people)
      ? people.filter((person) => person && person.name && person.image)
      : [];

    if (validPeople.length === 0) throw new Error("No valid partners found");

    // Display order follows the order in partners.json.
    grid.replaceChildren(...validPeople.map(createPersonCard));
  } catch (error) {
    console.error("Failed to load partners.json", error);
    const message = document.createElement("div");
    message.className = "people-error";
    message.textContent = "無法載入 partners.json";
    grid.replaceChildren(message);
  }
}

loadPeople();

/* Shared site utilities: loader, theme switcher, and back-to-top */
(() => {
  const loader = document.getElementById("siteLoader");
  const garageLoader = document.getElementById("garageLoader");
  const garageBrand = document.getElementById("garageBrand");
  const statusLabel = document.getElementById("loaderStatus");
  const progressBar = document.getElementById("loaderProgressBar");
  const particles = document.getElementById("loaderParticles");

  const themeToggle = document.getElementById("themeToggle");
  const themeText = themeToggle?.querySelector(".theme-toggle-text");
  const backToTop = document.getElementById("backToTop");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themes = [
    { id: "blue", label: "BLUE", color: "#020814" },
    { id: "red", label: "RACING", color: "#120306" },
    { id: "purple", label: "NEON", color: "#090315" }
  ];

  const applyTheme = (id) => {
    const theme = themes.find((item) => item.id === id) || themes[0];
    document.documentElement.dataset.theme = theme.id;
    localStorage.setItem("ubereats6Theme", theme.id);
    if (themeText) themeText.textContent = theme.label;
    if (themeToggle) {
      themeToggle.dataset.activeTheme = theme.id;
      themeToggle.setAttribute("aria-label", `切換網站主題，目前為 ${theme.label}`);
    }
    themeMeta?.setAttribute("content", theme.color);
  };

  applyTheme(localStorage.getItem("ubereats6Theme") || document.documentElement.dataset.theme || "blue");

  themeToggle?.addEventListener("click", () => {
    const current = themes.findIndex((item) => item.id === document.documentElement.dataset.theme);
    applyTheme(themes[(current + 1) % themes.length].id);
  });

  const updateBackToTop = () => {
    backToTop?.classList.toggle("is-visible", window.scrollY > 260);
  };
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();
  backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const skipIntro = sessionStorage.getItem("ubereats6IntroShown") === "1";
  if (!loader || skipIntro) {
    loader?.remove();
    document.documentElement.classList.remove("is-loading");
    return;
  }

  if (particles) {
    const particleCount = window.matchMedia("(max-width: 780px)").matches ? 42 : 52;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("i");
      const spread = 12 + Math.random() * 38;
      const side = index % 2 === 0 ? -1 : 1;
      particle.style.setProperty("--x", `${50 + side * spread}%`);
      particle.style.setProperty("--y", `${18 + Math.random() * 68}%`);
      particle.style.setProperty("--size", `${2 + Math.random() * 5}px`);
      particle.style.setProperty("--opacity", `${0.34 + Math.random() * 0.44}`);
      particle.style.setProperty("--duration", `${2.6 + Math.random() * 2.2}s`);
      particle.style.setProperty("--delay", `${-Math.random() * 4.2}s`);
      particle.style.setProperty("--drift-x", `${-18 + Math.random() * 36}px`);
      particle.style.setProperty("--drift-y", `${-28 - Math.random() * 48}px`);
      fragment.appendChild(particle);
    }
    particles.appendChild(fragment);
  }

  let assetProgress = 0;
  let assetsReady = false;
  let pageReady = document.readyState === "complete";
  let loaderFinished = false;

  const startedAt = performance.now();
  const minimumTotalDuration = 2200;
  const maximumDuration = 9000;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const updateLoader = (progress) => {
    const safe = clamp(progress, 0, 1);

    if (safe > 0.06) {
      loader.classList.add("is-awake");
    }
    if (safe > 0.18) {
      garageBrand?.classList.add("is-visible");
    }

    if (progressBar) {
      const sweep = -130 + safe * 560;
      progressBar.style.transform = `translateX(${sweep}%)`;
    }

    if (garageLoader) {
      garageLoader.classList.toggle("is-ready", safe >= 0.88);
    }
    if (statusLabel) {
      statusLabel.textContent = safe < 0.88 ? "IGNITION" : "READY GO!!";
    }
  };

  const collectImageUrls = async () => {
    const urls = new Set(Array.from(document.images).map((img) => img.currentSrc || img.src).filter(Boolean));
    if (!document.body.classList.contains("links-page")) {
      try {
        const [gamesRes, kartsRes] = await Promise.all([fetch("games.json"), fetch("karts.json")]);
        const [games, karts] = await Promise.all([gamesRes.json(), kartsRes.json()]);
        [...games, ...karts].forEach((item) => item?.image && urls.add(item.image));
      } catch (error) {
        console.warn("Loader preload list fallback:", error);
      }
    }
    return [...urls];
  };

  const preloadImages = async (urls) => {
    if (!urls.length) {
      assetProgress = 1;
      assetsReady = true;
      return;
    }
    let loaded = 0;
    await Promise.all(urls.map((url) => new Promise((resolve) => {
      const image = new Image();
      const done = () => {
        loaded += 1;
        assetProgress = loaded / urls.length;
        resolve();
      };
      image.onload = done;
      image.onerror = done;
      image.src = url;
    })));
    assetProgress = 1;
    assetsReady = true;
  };

  if (!pageReady) {
    window.addEventListener("load", () => { pageReady = true; }, { once: true });
  }
  collectImageUrls().then(preloadImages).catch(() => {
    assetProgress = 1;
    assetsReady = true;
  });

  const finishLoader = () => {
    if (loaderFinished) return;
    loaderFinished = true;
    sessionStorage.setItem("ubereats6IntroShown", "1");
    updateLoader(1);
    window.setTimeout(() => {
      loader.classList.add("is-hidden");
      document.documentElement.classList.remove("is-loading");
      window.setTimeout(() => loader.remove(), 500);
    }, 140);
  };

  const animate = () => {
    if (loaderFinished) return;
    const elapsed = performance.now() - startedAt;
    const timeProgress = clamp(elapsed / minimumTotalDuration, 0, 1);
    const assetLimit = assetsReady && pageReady ? 1 : Math.min(0.96, 0.14 + assetProgress * 0.82);
    const displayProgress = Math.min(timeProgress, assetLimit);

    updateLoader(displayProgress);

    if (elapsed >= minimumTotalDuration && assetsReady && pageReady) {
      finishLoader();
      return;
    }
    if (elapsed >= maximumDuration) {
      finishLoader();
      return;
    }
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
})();
