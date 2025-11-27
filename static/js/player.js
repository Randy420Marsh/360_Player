/* global THREE */

(() => {
  // DOM
  const playerShell = document.getElementById("playerShell");
  const canvas = document.getElementById("three360Canvas");

  const videoSurface = document.getElementById("videoSurface");
  const video = document.getElementById("video");

  const previewDragBar = document.getElementById("previewDragBar");
  const previewResizeHandle = document.getElementById("previewResizeHandle");

  const hud = document.getElementById("hud");
  const modeLabel = document.getElementById("modeLabel");

  const fovSlider = document.getElementById("fovSlider");
  const fovValue = document.getElementById("fovValue");

  const previewOpacity = document.getElementById("previewOpacity");
  const previewOpacityValue = document.getElementById("previewOpacityValue");
  const previewBorderToggle = document.getElementById("previewBorderToggle");
  const previewBorderColor = document.getElementById("previewBorderColor");

  // Playback state
  let hls = null;
  let mode = "normal"; // "normal" | "360"

  // Three.js state
  let renderer = null;
  let scene = null;
  let camera = null;
  let sphere = null;
  let videoTexture = null;

  const radius = 500;
  let lon = 0;
  let lat = 0;
  let isUserInteracting = false;
  let onDownX = 0, onDownY = 0, onDownLon = 0, onDownLat = 0;

  // FOV
  let fov = 75;
  const FOV_MIN = 40;
  const FOV_MAX = 120;

  // Preview window state (bounded inside playerShell)
  let previewEnabled = false;
  let previewX = 12;
  let previewY = 12;
  let previewW = 240;
  let previewH = 135;
  let previewAspect = 16 / 9;
  const PREVIEW_MIN_W = 120;

  // Border state
  let borderEnabled = false;
  let borderColor = "#00e5ff";

  // -------- Public API used by app.js / HTML onclick --------
  window.playStream = function playStream(url) {
    const u = String(url || "");
    const isM3U8 = /\.m3u8(\?|#|$)/i.test(u);

    // Ensure the video element can be used as a texture source
    video.crossOrigin = "anonymous";

    // Cleanup existing hls instance
    if (hls) {
      try { hls.destroy(); } catch (_) {}
      hls = null;
    }

    // Reset video
    try { video.pause(); } catch (_) {}
    video.removeAttribute("src");
    video.load();

    // Prefer hls.js when available
    if (isM3U8 && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true });
      hls.loadSource(u);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => console.warn("play() failed:", err));
      });

      hls.on(window.Hls.Events.ERROR, (_evt, data) => {
        console.warn("HLS error:", data);
      });

      return;
    }

    // Native HLS (Safari) or normal mp4/webm
    video.src = u;
    video.play().catch(err => console.warn("play() failed:", err));
  };

  window.toggle360Mode = function toggle360Mode() {
    setMode(mode === "normal" ? "360" : "normal");
  };

  window.setFovPreset = function setFovPreset(which) {
    if (which === "wide") setFov(100);
    if (which === "normal") setFov(75);
    if (which === "tele") setFov(55);
  };

  window.setFovFromSlider = function setFovFromSlider(val) {
    setFov(parseFloat(val));
  };

  window.adjustFov = function adjustFov(delta) {
    setFov(fov + delta);
  };

  window.nudgePan = function nudgePan(dxLon, dyLat) {
    if (mode !== "360") return;
    lon += dxLon;
    lat += dyLat;
    lat = clamp(lat, -85, 85);
  };

  window.resetView = function resetView() {
    lon = 0;
    lat = 0;
    setFov(75);
  };

  window.togglePreview = function togglePreview() {
    if (mode !== "360") return;
    previewEnabled = !previewEnabled;
    applyPreviewState();
    if (previewEnabled) {
      updatePreviewAspect();
      if (!previewW || previewW < PREVIEW_MIN_W) applyPreviewPresetInternal("medium");
    }
  };

  window.setPreviewOpacity = function setPreviewOpacity(val) {
    const v = clamp(parseInt(val, 10), 10, 100);
    previewOpacity.value = String(v);
    previewOpacityValue.textContent = `${v}%`;
    if (mode === "360") videoSurface.style.opacity = String(v / 100);
  };

  window.togglePreviewBorder = function togglePreviewBorder(isOn) {
    borderEnabled = Boolean(isOn);
    applyBorder();
  };

  window.setPreviewBorderColor = function setPreviewBorderColor(color) {
    borderColor = color || "#00e5ff";
    applyBorder();
  };

  window.applyPreviewPreset = function applyPreviewPreset(which) {
    if (mode !== "360") return;
    if (!previewEnabled) {
      previewEnabled = true;
      applyPreviewState();
    }
    applyPreviewPresetInternal(which);
  };
  
    // Expose mode check for shortcuts
  window.__playerInternal = {
    is360: () => mode === "360"
  };

  // -------- Init --------
  function init() {
    setFov(75);
    setPreviewOpacity(85);

    borderEnabled = !!previewBorderToggle.checked;
    borderColor = previewBorderColor.value || "#00e5ff";
    applyBorder();

    video.addEventListener("loadedmetadata", () => {
      updatePreviewAspect();
      if (mode === "360" && previewEnabled) {
        applyPreviewPresetInternal("medium");
        clampPreviewToBounds();
        applyPreviewGeometry();
      }
    });

    canvas.addEventListener("pointerdown", onCanvasPointerDown);
    canvas.addEventListener("wheel", onCanvasWheel, { passive: true });

    previewDragBar.addEventListener("pointerdown", onPreviewDragDown);
    previewResizeHandle.addEventListener("pointerdown", onPreviewResizeDown);

    const ro = new ResizeObserver(() => {
      if (renderer && camera) resizeThree();
      if (mode === "360" && previewEnabled) clampPreviewToBounds();
    });
    ro.observe(playerShell);

    requestAnimationFrame(animate);
    setMode("normal");
  }

  function setMode(next) {
    mode = next;
    const is360 = (mode === "360");

    modeLabel.textContent = is360 ? "360" : "Normal";
    canvas.classList.toggle("hidden", !is360);
    hud.classList.toggle("hidden", !is360);

    if (is360) {
      ensureThree();
      resizeThree();
      previewEnabled = false;
      hidePreviewSurfaceButKeepVideoAlive();
      setPreviewOpacity(parseInt(previewOpacity.value || "85", 10));
    } else {
      showNormalVideoSurface();
    }
  }

  function ensureThree() {
    if (renderer && scene && camera) return;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio || 1);

    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1100);
    camera.target = new THREE.Vector3(0, 0, 0);

    const geom = new THREE.SphereGeometry(radius, 64, 40);
    geom.scale(-1, 1, 1);

    videoTexture = new THREE.VideoTexture(video);
    if ("colorSpace" in videoTexture) videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;

    const mat = new THREE.MeshBasicMaterial({ map: videoTexture });
    sphere = new THREE.Mesh(geom, mat);
    scene.add(sphere);
  }

  function resizeThree() {
    const rect = playerShell.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function animate() {
    requestAnimationFrame(animate);
    if (mode !== "360" || !renderer || !scene || !camera) return;

    lat = clamp(lat, -85, 85);
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);

    camera.target.x = radius * Math.sin(phi) * Math.cos(theta);
    camera.target.y = radius * Math.cos(phi);
    camera.target.z = radius * Math.sin(phi) * Math.sin(theta);

    camera.lookAt(camera.target);
    renderer.render(scene, camera);
  }

  // -------- 360 interaction --------
  function onCanvasPointerDown(e) {
    if (mode !== "360") return;
    isUserInteracting = true;
    onDownX = e.clientX;
    onDownY = e.clientY;
    onDownLon = lon;
    onDownLat = lat;

    window.addEventListener("pointermove", onCanvasPointerMove);
    window.addEventListener("pointerup", onCanvasPointerUp);
    e.preventDefault();
  }

  function onCanvasPointerMove(e) {
    if (!isUserInteracting) return;
    const dx = e.clientX - onDownX;
    const dy = e.clientY - onDownY;

    lon = onDownLon - dx * 0.12;
    lat = onDownLat + dy * 0.12;
    lat = clamp(lat, -85, 85);
    e.preventDefault();
  }

  function onCanvasPointerUp(e) {
    isUserInteracting = false;
    window.removeEventListener("pointermove", onCanvasPointerMove);
    window.removeEventListener("pointerup", onCanvasPointerUp);
    e.preventDefault();
  }

  function onCanvasWheel(e) {
    if (mode !== "360") return;
    setFov(fov + (e.deltaY || 0) * 0.02);
  }

  function setFov(next) {
    fov = clamp(Number(next), FOV_MIN, FOV_MAX);
    if (camera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    fovSlider.value = String(Math.round(fov));
    fovValue.textContent = String(Math.round(fov));
  }

  // -------- Preview window logic --------
  function updatePreviewAspect() {
    if (video.videoWidth && video.videoHeight) {
      previewAspect = video.videoWidth / video.videoHeight;
    }
  }

  function applyPreviewPresetInternal(which) {
    updatePreviewAspect();

    const vw = video.videoWidth || 1280;
    const denom = (which === "small") ? 10 : (which === "large") ? 6 : 8;

    let targetW = Math.round(vw / denom);
    if (targetW < PREVIEW_MIN_W) targetW = PREVIEW_MIN_W;

    previewW = targetW;
    previewH = Math.round(previewW / previewAspect);

    clampPreviewToBounds();
    applyPreviewGeometry();
  }

  function applyPreviewState() {
    if (mode !== "360") return;
    if (!previewEnabled) {
      hidePreviewSurfaceButKeepVideoAlive();
      return;
    }

    videoSurface.style.left = `${previewX}px`;
    videoSurface.style.top = `${previewY}px`;
    videoSurface.style.width = `${previewW}px`;
    videoSurface.style.height = `${previewH}px`;
    videoSurface.style.opacity = String(clamp(parseInt(previewOpacity.value || "85", 10), 10, 100) / 100);
    videoSurface.style.pointerEvents = "auto";

    previewDragBar.classList.remove("hidden");
    previewResizeHandle.classList.remove("hidden");

    videoSurface.style.borderRadius = "10px";
    videoSurface.style.overflow = "hidden";

    applyBorder();
  }

  function hidePreviewSurfaceButKeepVideoAlive() {
    videoSurface.style.opacity = "0";
    videoSurface.style.pointerEvents = "none";
    videoSurface.style.width = "1px";
    videoSurface.style.height = "1px";
    videoSurface.style.left = "-9999px";
    videoSurface.style.top = "-9999px";

    previewDragBar.classList.add("hidden");
    previewResizeHandle.classList.add("hidden");
  }

  function showNormalVideoSurface() {
    videoSurface.style.left = "0px";
    videoSurface.style.top = "0px";
    videoSurface.style.width = "100%";
    videoSurface.style.height = "100%";
    videoSurface.style.opacity = "1";
    videoSurface.style.pointerEvents = "auto";

    previewDragBar.classList.add("hidden");
    previewResizeHandle.classList.add("hidden");

    videoSurface.style.borderRadius = "0px";
    videoSurface.style.overflow = "hidden";
    videoSurface.style.border = "none";
  }

  function getBounds() {
    const r = playerShell.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function clampPreviewToBounds() {
    const b = getBounds();

    previewW = clamp(previewW, PREVIEW_MIN_W, Math.max(PREVIEW_MIN_W, b.w - 8));
    previewH = Math.round(previewW / previewAspect);

    if (previewH > b.h - 8) {
      previewH = Math.max(60, b.h - 8);
      previewW = Math.round(previewH * previewAspect);
    }

    previewX = clamp(previewX, 0, Math.max(0, b.w - previewW));
    previewY = clamp(previewY, 0, Math.max(0, b.h - previewH));
  }

  function applyPreviewGeometry() {
    if (mode !== "360" || !previewEnabled) return;
    clampPreviewToBounds();
    videoSurface.style.left = `${previewX}px`;
    videoSurface.style.top = `${previewY}px`;
    videoSurface.style.width = `${previewW}px`;
    videoSurface.style.height = `${previewH}px`;
  }

  function applyBorder() {
    if (mode !== "360" || !previewEnabled) return;
    if (!borderEnabled) {
      videoSurface.style.border = "none";
      return;
    }
    videoSurface.style.border = `2px solid ${borderColor}`;
  }

  // Drag + Resize
  let dragging = false;
  let dragStartX = 0, dragStartY = 0;
  let startPreviewX = 0, startPreviewY = 0;

  function onPreviewDragDown(e) {
    if (mode !== "360" || !previewEnabled) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startPreviewX = previewX;
    startPreviewY = previewY;

    window.addEventListener("pointermove", onPreviewDragMove);
    window.addEventListener("pointerup", onPreviewDragUp);
    e.preventDefault();
  }

  function onPreviewDragMove(e) {
    if (!dragging) return;
    previewX = startPreviewX + (e.clientX - dragStartX);
    previewY = startPreviewY + (e.clientY - dragStartY);
    applyPreviewGeometry();
    e.preventDefault();
  }

  function onPreviewDragUp(e) {
    dragging = false;
    window.removeEventListener("pointermove", onPreviewDragMove);
    window.removeEventListener("pointerup", onPreviewDragUp);
    e.preventDefault();
  }

  let resizing = false;
  let resizeStartX = 0;
  let startW = 0;

  function onPreviewResizeDown(e) {
    if (mode !== "360" || !previewEnabled) return;
    resizing = true;
    resizeStartX = e.clientX;
    startW = previewW;

    window.addEventListener("pointermove", onPreviewResizeMove);
    window.addEventListener("pointerup", onPreviewResizeUp);
    e.preventDefault();
  }

  function onPreviewResizeMove(e) {
    if (!resizing) return;
    previewW = Math.round(Math.max(PREVIEW_MIN_W, startW + (e.clientX - resizeStartX)));
    previewH = Math.round(previewW / previewAspect);
    applyPreviewGeometry();
    e.preventDefault();
  }

  function onPreviewResizeUp(e) {
    resizing = false;
    window.removeEventListener("pointermove", onPreviewResizeMove);
    window.removeEventListener("pointerup", onPreviewResizeUp);
    e.preventDefault();
  }

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  init();
})();

