(() => {
  const STORAGE_KEY = "ubereats6KeyboardBuilderConfigV2";
  const keyDefinitions = [
    { id: "up", label: "上", display: "↑", code: "ArrowUp" },
    { id: "down", label: "下", display: "↓", code: "ArrowDown" },
    { id: "left", label: "左", display: "←", code: "ArrowLeft" },
    { id: "right", label: "右", display: "→", code: "ArrowRight" },
    { id: "shift", label: "Shift", display: "SHIFT", code: "ShiftLeft" },
    { id: "ctrl", label: "Ctrl", display: "CTRL", code: "ControlLeft" },
    { id: "alt", label: "Alt", display: "ALT", code: "AltLeft" },
    { id: "r", label: "R／重置", display: "R", code: "KeyR" }
  ];

  const presets = {
    neon: { keyColor: "#0b2d59", pressedColor: "#52d7ff", textColor: "#ffffff", borderColor: "#2c98ff", radius: 16, glow: 18, backgroundOpacity: 35 },
    cute: { keyColor: "#f3a9d0", pressedColor: "#fff27a", textColor: "#39243f", borderColor: "#ffd6ec", radius: 24, glow: 14, backgroundOpacity: 42 },
    racing: { keyColor: "#351014", pressedColor: "#ff3b4f", textColor: "#ffffff", borderColor: "#ff5365", radius: 8, glow: 24, backgroundOpacity: 30 },
    minimal: { keyColor: "#202631", pressedColor: "#ffffff", textColor: "#ffffff", borderColor: "#9aa8ba", radius: 10, glow: 0, backgroundOpacity: 0 }
  };

  const defaultPositions = {
    shift: { x: 34, y: 32, w: 162, h: 70 },
    up:    { x: 282, y: 32, w: 76, h: 70 },
    alt:   { x: 444, y: 32, w: 162, h: 70 },
    ctrl:  { x: 34, y: 114, w: 76, h: 70 },
    left:  { x: 120, y: 114, w: 76, h: 70 },
    down:  { x: 206, y: 114, w: 76, h: 70 },
    right: { x: 292, y: 114, w: 76, h: 70 },
    r:     { x: 378, y: 114, w: 76, h: 70 }
  };

  const defaultConfig = () => ({
    version: 2,
    app: "UberEats6-KeyOverlay",
    layout: "classic",
    preset: "neon",
    scale: 100,
    radius: 16,
    glow: 18,
    backgroundOpacity: 35,
    backgroundSize: 100,
    keyColor: "#0b2d59",
    pressedColor: "#52d7ff",
    textColor: "#ffffff",
    borderColor: "#2c98ff",
    backgroundImage: "",
    backgroundImageName: "",
    backgroundImageType: "",
    coordinateSystem: {
      canvasWidth: 640,
      canvasHeight: 360,
      customAreaX: 0,
      customAreaY: 60,
      customAreaWidth: 640,
      customAreaHeight: 240
    },
    positions: JSON.parse(JSON.stringify(defaultPositions)),
    bindings: Object.fromEntries(keyDefinitions.map((key) => [key.id, key.code]))
  });

  let config = defaultConfig();
  let listeningFor = null;
  let dragState = null;
  const pressedCodes = new Set();

  const bindingList = document.getElementById("bindingList");
  const keyOverlay = document.getElementById("keyOverlay");
  const overlayCanvas = document.getElementById("overlayCanvas");
  const overlayBackground = document.getElementById("overlayBackground");
  const previewStage = document.getElementById("previewStage");
  const status = document.getElementById("builderStatus");

  if (!bindingList || !keyOverlay || !overlayCanvas || !previewStage) return;

  const controls = {
    layout: document.getElementById("layoutSelect"),
    preset: document.getElementById("presetSelect"),
    keyColor: document.getElementById("keyColor"),
    pressedColor: document.getElementById("pressedColor"),
    textColor: document.getElementById("textColor"),
    borderColor: document.getElementById("borderColor"),
    scale: document.getElementById("scaleRange"),
    radius: document.getElementById("radiusRange"),
    glow: document.getElementById("glowRange"),
    backgroundOpacity: document.getElementById("backgroundOpacityRange"),
    backgroundSize: document.getElementById("backgroundSizeRange")
  };

  const codeLabel = (code) => {
    const aliases = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "左 Shift", ShiftRight: "右 Shift", ControlLeft: "左 Ctrl", ControlRight: "右 Ctrl", AltLeft: "左 Alt", AltRight: "右 Alt", Space: "Space" };
    if (aliases[code]) return aliases[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    return code.replace(/Left|Right/g, (side) => side === "Left" ? " 左" : " 右");
  };

  const setStatus = (message) => {
    status.textContent = message;
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(() => { status.textContent = ""; }, 2600);
  };

  function renderBindings() {
    bindingList.replaceChildren(...keyDefinitions.map((definition) => {
      const row = document.createElement("div");
      row.className = "binding-row";
      const label = document.createElement("span");
      label.textContent = `畫面 ${definition.label}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "binding-button";
      button.dataset.bindingId = definition.id;
      button.textContent = listeningFor === definition.id ? "請按下按鍵…" : codeLabel(config.bindings[definition.id]);
      button.classList.toggle("is-listening", listeningFor === definition.id);
      button.addEventListener("click", () => {
        listeningFor = definition.id;
        renderBindings();
        previewStage.focus();
      });
      row.append(label, button);
      return row;
    }));
  }

  function startDrag(event, keyId) {
    if (config.layout !== "custom") return;
    event.preventDefault();
    const position = config.positions[keyId];
    const rect = keyOverlay.getBoundingClientRect();
    const scaleX = keyOverlay.offsetWidth / rect.width;
    const scaleY = keyOverlay.offsetHeight / rect.height;
    dragState = {
      keyId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      scaleX,
      scaleY
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.classList.add("is-dragging");
  }

  function moveDrag(event) {
    if (!dragState) return;
    const pos = config.positions[dragState.keyId];
    const dx = (event.clientX - dragState.startX) * dragState.scaleX;
    const dy = (event.clientY - dragState.startY) * dragState.scaleY;
    pos.x = Math.max(0, Math.min(640 - pos.w, dragState.originX + dx));
    pos.y = Math.max(0, Math.min(240 - pos.h, dragState.originY + dy));
    const key = keyOverlay.querySelector(`[data-key-id="${dragState.keyId}"]`);
    if (key) {
      key.style.left = `${pos.x}px`;
      key.style.top = `${pos.y}px`;
    }
  }

  function endDrag() {
    if (!dragState) return;
    keyOverlay.querySelector(`[data-key-id="${dragState.keyId}"]`)?.classList.remove("is-dragging");
    dragState = null;
    setStatus("自訂位置已更新。")
  }

  function renderKeys() {
    keyOverlay.replaceChildren(...keyDefinitions.map((definition) => {
      const key = document.createElement("div");
      key.className = "overlay-key";
      key.dataset.keyId = definition.id;
      key.dataset.code = config.bindings[definition.id];
      key.textContent = definition.display;
      key.classList.toggle("is-pressed", pressedCodes.has(config.bindings[definition.id]));

      if (config.layout === "custom") {
        const pos = config.positions[definition.id] || defaultPositions[definition.id];
        key.style.left = `${pos.x}px`;
        key.style.top = `${pos.y}px`;
        key.style.width = `${pos.w}px`;
        key.style.height = `${pos.h}px`;
        key.addEventListener("pointerdown", (event) => startDrag(event, definition.id));
      }
      return key;
    }));
  }

  function applyConfig() {
    keyOverlay.className = `key-overlay layout-${config.layout}`;
    overlayCanvas.style.setProperty("--key-color", config.keyColor);
    overlayCanvas.style.setProperty("--pressed-color", config.pressedColor);
    overlayCanvas.style.setProperty("--key-text", config.textColor);
    overlayCanvas.style.setProperty("--key-border", config.borderColor);
    overlayCanvas.style.setProperty("--key-radius", `${config.radius}px`);
    overlayCanvas.style.setProperty("--key-glow", `${config.glow}px`);
    overlayCanvas.style.setProperty("--overlay-scale", String(config.scale / 100));
    overlayCanvas.style.setProperty("--bg-opacity", String(config.backgroundOpacity / 100));
    overlayCanvas.style.setProperty("--bg-size", `${config.backgroundSize}%`);
    overlayBackground.style.backgroundImage = config.backgroundImage ? `url(${JSON.stringify(config.backgroundImage)})` : "none";

    controls.layout.value = config.layout;
    controls.preset.value = config.preset;
    controls.keyColor.value = config.keyColor;
    controls.pressedColor.value = config.pressedColor;
    controls.textColor.value = config.textColor;
    controls.borderColor.value = config.borderColor;
    controls.scale.value = config.scale;
    controls.radius.value = config.radius;
    controls.glow.value = config.glow;
    controls.backgroundOpacity.value = config.backgroundOpacity;
    controls.backgroundSize.value = config.backgroundSize;
    document.getElementById("scaleValue").textContent = `${config.scale}%`;
    document.getElementById("radiusValue").textContent = `${config.radius}px`;
    document.getElementById("glowValue").textContent = `${config.glow}px`;
    document.getElementById("backgroundOpacityValue").textContent = `${config.backgroundOpacity}%`;
    document.getElementById("backgroundSizeValue").textContent = `${config.backgroundSize}%`;
    document.getElementById("customLayoutHint")?.classList.toggle("is-active", config.layout === "custom");
    renderBindings();
    renderKeys();
  }

  controls.layout.addEventListener("change", (event) => {
    config.layout = event.target.value;
    if (config.layout === "custom" && !config.positions) config.positions = JSON.parse(JSON.stringify(defaultPositions));
    applyConfig();
  });
  controls.preset.addEventListener("change", (event) => {
    config = { ...config, ...presets[event.target.value], preset: event.target.value };
    applyConfig();
  });
  ["keyColor", "pressedColor", "textColor", "borderColor"].forEach((name) => {
    controls[name].addEventListener("input", (event) => { config[name] = event.target.value; applyConfig(); });
  });
  [["scale", "scale"], ["radius", "radius"], ["glow", "glow"], ["backgroundOpacity", "backgroundOpacity"], ["backgroundSize", "backgroundSize"]].forEach(([controlName, configName]) => {
    controls[controlName].addEventListener("input", (event) => { config[configName] = Number(event.target.value); applyConfig(); });
  });

  document.getElementById("backgroundUpload")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setStatus("圖片過大，請使用 2.5 MB 以下的圖片。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      config.backgroundImage = String(reader.result || "");
      config.backgroundImageName = file.name || "background";
      config.backgroundImageType = file.type || "";
      applyConfig();
      setStatus("背景圖片已嵌入設定，可隨 JSON 一起下載。");
    };
    reader.onerror = () => {
      config.backgroundImage = "";
      config.backgroundImageName = "";
      config.backgroundImageType = "";
      setStatus("背景圖片讀取失敗，請重新選擇圖片。");
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("removeBackground")?.addEventListener("click", () => {
    config.backgroundImage = "";
    config.backgroundImageName = "";
    config.backgroundImageType = "";
    const upload = document.getElementById("backgroundUpload");
    if (upload) upload.value = "";
    applyConfig();
    setStatus("背景圖片已移除。")
  });

  document.querySelectorAll("[data-preview-bg]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-preview-bg]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      previewStage.className = `keyboard-preview-stage preview-${button.dataset.previewBg}`;
    });
  });

  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  function handleKeyDown(event) {
    if (listeningFor) {
      event.preventDefault();
      config.bindings[listeningFor] = event.code;
      listeningFor = null;
      applyConfig();
      setStatus("鍵位已更新。")
      return;
    }
    if (Object.values(config.bindings).includes(event.code)) {
      event.preventDefault();
      pressedCodes.add(event.code);
      renderKeys();
    }
  }
  function handleKeyUp(event) {
    if (pressedCodes.delete(event.code)) renderKeys();
  }
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  window.addEventListener("blur", () => { pressedCodes.clear(); renderKeys(); });

  document.getElementById("saveConfig")?.addEventListener("click", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setStatus("設定已儲存在這個瀏覽器。")
    } catch {
      setStatus("背景圖片太大，無法儲存到瀏覽器；仍可下載 JSON。")
    }
  });

  document.getElementById("downloadConfig")?.addEventListener("click", () => {
    const exportConfig = {
      ...config,
      coordinateSystem: {
        canvasWidth: 640,
        canvasHeight: 360,
        customAreaX: 0,
        customAreaY: 60,
        customAreaWidth: 640,
        customAreaHeight: 240
      },
      exportedAt: new Date().toISOString()
    };

    // Uploaded images are exported as a data URL (Base64) inside the JSON.
    // This makes overlay-config.json self-contained for the desktop app.
    if (config.backgroundImage && !config.backgroundImage.startsWith("data:image/")) {
      setStatus("背景圖片尚未完成嵌入，請重新選擇圖片後再下載。");
      return;
    }

    const blob = new Blob(
      [JSON.stringify(exportConfig, null, 2)],
      { type: "application/json;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "overlay-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(
      config.backgroundImage
        ? "設定與背景圖片已一起嵌入 JSON。"
        : "overlay-config.json 已下載。"
    );
  });

  document.getElementById("resetBuilder")?.addEventListener("click", () => {
    config = defaultConfig();
    localStorage.removeItem(STORAGE_KEY);
    applyConfig();
    setStatus("已恢復預設設定。")
  });

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.version === 2) {
      config = {
        ...defaultConfig(),
        ...saved,
        bindings: { ...defaultConfig().bindings, ...(saved.bindings || {}) },
        positions: { ...JSON.parse(JSON.stringify(defaultPositions)), ...(saved.positions || {}) }
      };
    }
  } catch {}

  applyConfig();
})();
