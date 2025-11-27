document.addEventListener("keydown", (e) => {
  const t = e.target;
  const tag = (t && t.tagName) ? t.tagName.toLowerCase() : "";
  const typing = tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable);
  if (typing) return;

  const video = document.getElementById("video");
  const is360 = window.__playerInternal?.is360?.() === true;

  // Space: play/pause (only meaningful when video is visible or used as source)
  if (e.key === " ") {
    e.preventDefault();
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    return;
  }

  // Mode toggles
  if (e.key.toLowerCase() === "v") {
    window.toggle360Mode?.();
    return;
  }
  if (e.key.toLowerCase() === "p") {
    if (is360) window.togglePreview?.();
    return;
  }

  // FOV adjust
  if (is360 && (e.key === "+" || e.key === "=")) {
    window.adjustFov?.(-3); // zoom in (smaller fov)
    return;
  }
  if (is360 && (e.key === "-" || e.key === "_")) {
    window.adjustFov?.(3); // zoom out (bigger fov)
    return;
  }

  // Arrow pan
  if (is360 && e.key === "ArrowUp") { window.nudgePan?.(0, -6); return; }
  if (is360 && e.key === "ArrowDown") { window.nudgePan?.(0, 6); return; }
  if (is360 && e.key === "ArrowLeft") { window.nudgePan?.(-6, 0); return; }
  if (is360 && e.key === "ArrowRight") { window.nudgePan?.(6, 0); return; }

  // Reset view
  if (is360 && e.key.toLowerCase() === "r") {
    window.resetView?.();
    return;
  }

  // Preview size presets (auto-enables preview)
  if (is360 && e.key === "1") { window.applyPreviewPreset?.("small"); return; }
  if (is360 && e.key === "2") { window.applyPreviewPreset?.("medium"); return; }
  if (is360 && e.key === "3") { window.applyPreviewPreset?.("large"); return; }

  // Mute + fullscreen for normal video
  if (e.key.toLowerCase() === "m") {
    video.muted = !video.muted;
    return;
  }
  if (e.key.toLowerCase() === "f") {
    const shell = document.getElementById("playerShell");
    shell.requestFullscreen?.().catch(() => {});
  }
});

