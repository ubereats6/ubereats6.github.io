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


const toolArrowIcon = `
  <svg class="useful-link-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h12.2l-4.6-4.6L14 6l7 7-7 7-1.4-1.4 4.6-4.6H5v-2Z"/>
  </svg>`;

async function loadTools() {
  const list = document.getElementById("toolsList");
  if (!list) return;

  try {
    const response = await fetch("tools.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const tools = await response.json();
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error("No tools found");
    }

    const cards = tools.map((item, index) => {
      const article = document.createElement("article");
      const status = item.status === "coming-soon" ? "coming-soon" : "available";
      article.className = `useful-link-card tool-card${status === "coming-soon" ? " is-coming-soon" : ""}`;

      const number = document.createElement("span");
      number.className = "useful-link-number";
      number.textContent = item.id || String(index + 1).padStart(2, "0");

      const copy = document.createElement("div");
      copy.className = "useful-link-copy";

      const category = document.createElement("span");
      category.className = "useful-link-category";
      category.textContent = item.category || (status === "coming-soon" ? "FUTURE TOOL" : "TOOL");

      const title = document.createElement("h3");
      title.textContent = item.title || "未命名工具";

      const description = document.createElement("p");
      description.textContent = item.description || "";

      copy.append(category, title, description);

      let action;
      if (status === "coming-soon" || !item.url) {
        action = document.createElement("span");
        action.className = "useful-link-button tool-coming-button";
        action.textContent = item.buttonText || "COMING SOON";
      } else {
        action = document.createElement("a");
        action.className = "useful-link-button";
        action.href = item.url;
        action.innerHTML = `${item.buttonText || "OPEN TOOL"} ${toolArrowIcon}`;

        if (item.newTab === true) {
          action.target = "_blank";
          action.rel = "noopener noreferrer";
        }
      }

      article.append(number, copy, action);
      return article;
    });

    list.replaceChildren(...cards);
  } catch (error) {
    console.error("Failed to load tools.json", error);
    list.innerHTML = '<div class="links-error">無法載入 tools.json。請透過 GitHub Pages 或本機伺服器預覽。</div>';
  }
}

loadTools();

const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");
const musicToggleText = musicToggle?.querySelector(".music-toggle-text");
const nowPlaying = document.getElementById("nowPlaying");
const nowPlayingStatus = document.getElementById("nowPlayingStatus");
const MUSIC_STORAGE_KEY = "ubereats6MusicEnabled";
let musicWanted = false;
// Clear any old saved ON state so a page click/key press can never start music.
try { localStorage.setItem(MUSIC_STORAGE_KEY, "false"); } catch {}
let nowPlayingHideTimer = null;
let utilityStackTimer = null;

if (bgMusic) bgMusic.volume = 0.20;

function renderMusicState(isPlaying) {
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

  nowPlaying?.classList.add("is-visible");
  document.body.classList.add("now-playing-active");

  if (isPlaying) {
    // Desktop keeps the card open. Mobile uses a compact 2.2-second toast.
    if (!isMobileLayout) return;

    nowPlayingHideTimer = window.setTimeout(() => {
      if (bgMusic?.paused) return;
      nowPlaying?.classList.remove("is-visible");

      utilityStackTimer = window.setTimeout(() => {
        if (!bgMusic?.paused) document.body.classList.remove("now-playing-active");
      }, 380);
    }, 2200);
    return;
  }

  // When paused, show PAUSED briefly, fade out, then move TOP downward.
  nowPlayingHideTimer = window.setTimeout(() => {
    if (!bgMusic?.paused) return;
    nowPlaying?.classList.remove("is-visible");

    utilityStackTimer = window.setTimeout(() => {
      if (bgMusic?.paused) document.body.classList.remove("now-playing-active");
    }, isMobileLayout ? 380 : 520);
  }, 1000);
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
  else {
    pauseMusic();
  }
});

// Do not attach page-wide pointer/keyboard listeners for music playback.

musicToggle?.classList.remove("is-playing");
musicToggle?.setAttribute("aria-pressed", "false");
musicToggle?.setAttribute("aria-label", "播放背景音樂");
if (musicToggleText) musicToggleText.textContent = "MUSIC OFF";
nowPlaying?.classList.remove("is-visible", "is-playing");
document.body.classList.remove("now-playing-active");


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
