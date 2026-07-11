(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const app = $("#app");
  const video = $("#camera");
  const sourceCanvas = $("#source-canvas");
  const outputCanvas = $("#output");
  const welcome = $("#welcome");
  const cameraUi = $("#camera-ui");
  const startCameraButton = $("#start-camera");
  const startDemoButton = $("#start-demo");
  const uploadVideoButton = $("#upload-video");
  const videoUploadInput = $("#video-upload");
  const exitDemoButton = $("#exit-demo");
  const flipButton = $("#flip-camera");
  const flipLabel = $("#flip-label");
  const sessionBadge = $("#session-badge");
  const captureButton = $("#capture-button");
  const settingsButton = $("#settings-button");
  const infoButton = $("#info-button");
  const liveLabel = $("#live-label");
  const pointCount = $("#point-count");
  const modeLabel = $("#mode-label");
  const loadingState = $("#loading-state");
  const loadingCopy = $("#loading-copy");
  const toast = $("#toast");
  const settingsDialog = $("#settings-dialog");
  const aboutDialog = $("#about-dialog");
  const aboutClose = $("#about-close");
  const captureDialog = $("#capture-dialog");
  const captureClose = $("#capture-close");
  const capturePreview = $("#capture-preview");
  const shareCapture = $("#share-capture");
  const saveCapture = $("#save-capture");
  const densityInput = $("#density");
  const dotSizeInput = $("#dot-size");
  const trailInput = $("#trail");
  const densityValue = $("#density-value");
  const dotSizeValue = $("#dot-size-value");
  const trailValue = $("#trail-value");
  const paletteControl = $("#palette-control");
  const resetSettingsButton = $("#reset-settings");
  const stopCameraButton = $("#stop-camera");

  const SETTINGS_KEY = "dotcam.settings.v1";
  const DEFAULT_SETTINGS = Object.freeze({
    density: 72,
    dotSize: 1.8,
    trail: 64,
    palette: "prism",
  });

  let settings = loadSettings();
  let stream = null;
  let uploadedVideoUrl = null;
  let facingMode = "environment";
  let currentMode = "idle";
  let demoScene = null;
  let captureBlob = null;
  let captureUrl = null;
  let toastTimer = 0;
  let wakeLock = null;
  let lastStatsUpdate = 0;
  let isStartingCamera = false;
  let trackEndedHandler = null;
  let trackMuteHandler = null;
  let trackUnmuteHandler = null;
  let trackMuteTimer = 0;

  if (typeof window.DotFilterEngine !== "function") {
    showToast("The visual engine could not start. Refresh the page and try again.", 7000);
    startCameraButton.disabled = true;
    startDemoButton.disabled = true;
    uploadVideoButton.disabled = true;
    return;
  }

  const engine = new window.DotFilterEngine({
    sourceCanvas,
    outputCanvas,
    onStats(stats) {
      const now = performance.now();
      if (now - lastStatsUpdate < 220) return;
      lastStatsUpdate = now;
      const count = typeof stats === "number" ? stats : stats?.pointCount ?? stats?.points ?? 0;
      pointCount.textContent = `${Math.round(count)} POINTS`;
    },
  });

  applySettings(settings, false);

  class DemoScene {
    constructor() {
      this.canvas = document.createElement("canvas");
      this.canvas.width = 720;
      this.canvas.height = 1280;
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.specks = [];
      this.seedSpecks();
    }

    seedSpecks() {
      let seed = 72391;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      for (let index = 0; index < 180; index += 1) {
        this.specks.push({
          x: random() * this.canvas.width,
          y: random() * this.canvas.height,
          radius: 0.4 + random() * 1.6,
          alpha: 0.035 + random() * 0.14,
          hue: 165 + random() * 95,
        });
      }
    }

    update(time = 0) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const seconds = time * 0.001;
      const sway = Math.sin(seconds * 0.72);
      const breathe = Math.sin(seconds * 1.35);

      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#10171d");
      background.addColorStop(0.48, "#263038");
      background.addColorStop(1, "#11191a");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width * 0.76, height * 0.22, 10, width * 0.76, height * 0.22, 430);
      glow.addColorStop(0, "rgba(155, 223, 235, .54)");
      glow.addColorStop(0.4, "rgba(84, 129, 140, .23)");
      glow.addColorStop(1, "rgba(16, 22, 26, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = "rgba(211, 234, 224, .14)";
      ctx.lineWidth = 2;
      for (let x = 80; x < width; x += 140) {
        ctx.beginPath();
        ctx.moveTo(x, 70);
        ctx.lineTo(x + 16 * Math.sin(seconds * 0.18 + x), height - 80);
        ctx.stroke();
      }
      for (let y = 100; y < height; y += 175) {
        ctx.beginPath();
        ctx.moveTo(45, y);
        ctx.lineTo(width - 45, y + 7 * Math.sin(seconds * 0.3 + y));
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const speck of this.specks) {
        const pulse = 0.7 + 0.3 * Math.sin(seconds * 0.85 + speck.x * 0.019);
        ctx.fillStyle = `hsla(${speck.hue}, 52%, 74%, ${speck.alpha * pulse})`;
        ctx.beginPath();
        ctx.arc(speck.x, speck.y, speck.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(width * 0.5 + sway * 13, height * 0.61 + breathe * 5);
      ctx.rotate(sway * 0.015);

      const bodyGradient = ctx.createLinearGradient(-250, -100, 260, 340);
      bodyGradient.addColorStop(0, "#3b5454");
      bodyGradient.addColorStop(0.46, "#718579");
      bodyGradient.addColorStop(1, "#273b3c");
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(0, 330, 310 + breathe * 3, 330 + breathe * 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#67786f";
      ctx.beginPath();
      ctx.roundRect(-72, 55, 144, 190, 50);
      ctx.fill();

      const faceGradient = ctx.createRadialGradient(-42, -155, 18, -5, -105, 235);
      faceGradient.addColorStop(0, "#d8b795");
      faceGradient.addColorStop(0.52, "#a87563");
      faceGradient.addColorStop(1, "#684c4f");
      ctx.fillStyle = faceGradient;
      ctx.beginPath();
      ctx.ellipse(0, -82, 148, 202, sway * 0.02, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#20272b";
      ctx.beginPath();
      ctx.ellipse(-6, -230, 152, 92, -0.06, Math.PI, Math.PI * 2);
      ctx.lineTo(143, -67);
      ctx.quadraticCurveTo(115, -160, 88, -194);
      ctx.quadraticCurveTo(35, -238, -6, -230);
      ctx.fill();

      ctx.fillStyle = "rgba(39, 31, 34, .8)";
      ctx.beginPath();
      ctx.ellipse(-53, -93, 15, 8, -0.04, 0, Math.PI * 2);
      ctx.ellipse(55, -91, 15, 8, 0.04, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(67, 42, 43, .8)";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-38, 7);
      ctx.quadraticCurveTo(0, 26 + breathe * 2, 44, 1);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-2, -71);
      ctx.quadraticCurveTo(-12, -18, 7, -12);
      ctx.stroke();

      ctx.save();
      ctx.translate(201, 12);
      ctx.rotate(-0.34 + sway * 0.16);
      const armGradient = ctx.createLinearGradient(-20, 0, 170, -210);
      armGradient.addColorStop(0, "#87605c");
      armGradient.addColorStop(1, "#c79d80");
      ctx.fillStyle = armGradient;
      ctx.beginPath();
      ctx.roundRect(-30, -20, 82, 310, 38);
      ctx.fill();
      ctx.translate(8, -23);
      ctx.rotate(-0.08 - sway * 0.15);
      ctx.beginPath();
      ctx.ellipse(14, -48, 58, 80, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 24;
      ctx.lineCap = "round";
      for (let finger = 0; finger < 4; finger += 1) {
        ctx.beginPath();
        ctx.moveTo(-28 + finger * 22, -84);
        ctx.lineTo(-42 + finger * 27, -165 - (finger % 2) * 13);
        ctx.strokeStyle = finger % 2 ? "#b98b76" : "#c79d80";
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(211, 255, 128, .25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -82, 178, 229, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(54, height - 110);
      ctx.fillStyle = "rgba(222, 240, 228, .48)";
      ctx.font = "600 18px ui-sans-serif, system-ui";
      ctx.letterSpacing = "6px";
      ctx.fillText("MOVE · LIGHT · TRACE", 0, 0);
      ctx.fillStyle = "rgba(218, 255, 105, .72)";
      ctx.fillRect(0, 22, 58 + Math.sin(seconds) * 15, 3);
      ctx.restore();

      ctx.fillStyle = `rgba(255,255,255,${0.018 + Math.sin(seconds * 2.3) * 0.006})`;
      for (let y = 0; y < height; y += 8) ctx.fillRect(0, y, width, 1);
    }
  }

  async function startCamera(options = {}) {
    if (isStartingCamera) return;

    if (!window.isSecureContext && !isLocalAddress()) {
      showToast("Camera access needs a secure HTTPS page. The live site will work; you can preview the effect here.", 6500);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("This browser does not expose a camera API. Try the demo, or open DotCam in Safari or Chrome.", 6500);
      return;
    }

    isStartingCamera = true;
    setLoading(true, options.switching ? "Turning the camera around…" : "Opening camera…");
    startCameraButton.disabled = true;

    try {
      stopStream();
      clearUploadedVideo();
      engine.stop();
      video.loop = false;

      const preferredConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1920 },
          frameRate: { ideal: 30, max: 30 },
        },
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (error) {
        if (error?.name !== "OverconstrainedError") throw error;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      video.srcObject = stream;
      await waitForVideo(video);
      await video.play();

      attachTrackLifecycle();

      demoScene = null;
      currentMode = "camera";
      engine.start(video, { mirror: facingMode === "user" });
      activateCameraUi("LIVE");
      await updateCameraAvailability();
      requestWakeLock();
    } catch (error) {
      stopStream();
      currentMode = "idle";
      deactivateCameraUi();
      showToast(cameraErrorMessage(error), 7600);
      setCameraButtonLabel("Try camera again", "Retry");
    } finally {
      isStartingCamera = false;
      startCameraButton.disabled = false;
      setLoading(false);
    }
  }

  function startDemo() {
    setLoading(true, "Building a field of light…");
    try {
      stopStream();
      clearUploadedVideo();
      engine.stop();

      if (!demoScene) demoScene = new DemoScene();
      demoScene.update(performance.now());
      currentMode = "demo";
      engine.start(demoScene.canvas, {
        mirror: false,
        beforeFrame: (time) => demoScene?.update(time),
      });
      activateCameraUi("DEMO");
      requestWakeLock();
    } catch {
      currentMode = "idle";
      deactivateCameraUi();
      showToast("The preview could not start in this browser. Reload DotCam and try again.", 6500);
    } finally {
      setLoading(false);
    }
  }

  async function startUploadedVideo(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith("video/")) {
      videoUploadInput.value = "";
      showToast("Choose a video file to use this source.");
      return;
    }

    setLoading(true, "Preparing your video…");
    try {
      stopStream();
      engine.stop();
      clearUploadedVideo();

      uploadedVideoUrl = URL.createObjectURL(file);
      video.srcObject = null;
      video.src = uploadedVideoUrl;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.load();
      await waitForVideo(video);
      await video.play();

      demoScene = null;
      currentMode = "upload";
      engine.start(video, { mirror: false });
      activateCameraUi("VIDEO");
      requestWakeLock();
      showToast(`${shortFileName(file.name)} is playing locally. Nothing was uploaded.`, 5200);
    } catch {
      clearUploadedVideo();
      currentMode = "idle";
      deactivateCameraUi();
      showToast("That video could not be played here. Try an MP4, MOV, or WebM file your browser supports.", 7000);
    } finally {
      videoUploadInput.value = "";
      setLoading(false);
    }
  }

  function activateCameraUi(label) {
    app.scrollTop = 0;
    app.classList.add("is-live");
    cameraUi.hidden = false;
    liveLabel.textContent = label;
    exitDemoButton.hidden = currentMode === "camera";
    sessionBadge.textContent = currentMode === "upload" ? "VIDEO" : "DEMO";

    if (currentMode === "upload") {
      flipButton.style.visibility = "visible";
      flipButton.disabled = false;
      flipButton.style.opacity = "1";
      flipButton.setAttribute("aria-label", "Choose another video");
      flipLabel.textContent = "CHANGE";
    } else if (currentMode === "demo") {
      flipButton.style.visibility = "hidden";
    } else {
      flipButton.style.visibility = "visible";
      flipButton.setAttribute("aria-label", "Flip camera");
      flipLabel.textContent = "FLIP";
    }
    modeLabel.textContent = settings.palette.toUpperCase();
    stopCameraButton.hidden = false;
  }

  function deactivateCameraUi() {
    engine.stop();
    app.scrollTop = 0;
    app.classList.remove("is-live");
    cameraUi.hidden = true;
    liveLabel.textContent = "READY";
    pointCount.textContent = "0 POINTS";
    stopCameraButton.hidden = true;
  }

  function stopEverything() {
    stopStream();
    clearUploadedVideo();
    engine.stop();
    demoScene = null;
    currentMode = "idle";
    deactivateCameraUi();
    releaseWakeLock();
  }

  function stopStream() {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      if (trackEndedHandler) track.removeEventListener("ended", trackEndedHandler);
      if (trackMuteHandler) track.removeEventListener("mute", trackMuteHandler);
      if (trackUnmuteHandler) track.removeEventListener("unmute", trackUnmuteHandler);
      track.stop();
    }
    window.clearTimeout(trackMuteTimer);
    stream = null;
    trackEndedHandler = null;
    trackMuteHandler = null;
    trackUnmuteHandler = null;
    video.srcObject = null;
  }

  function clearUploadedVideo() {
    if (!uploadedVideoUrl) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = null;
  }

  function attachTrackLifecycle() {
    if (!stream) return;
    trackEndedHandler = () => {
      if (currentMode !== "camera" || isStartingCamera) return;
      stopStream();
      currentMode = "idle";
      deactivateCameraUi();
      setCameraButtonLabel("Restart camera", "Restart");
      showToast("The camera session ended. Tap Restart camera to reconnect.", 7000);
    };
    trackMuteHandler = (event) => {
      if (currentMode !== "camera" || document.hidden) return;
      window.clearTimeout(trackMuteTimer);
      trackMuteTimer = window.setTimeout(() => {
        if (event.target.muted && currentMode === "camera") {
          engine.pause?.();
          liveLabel.textContent = "PAUSED";
          showToast("The camera feed paused. Return to this tab or restart the camera if it does not resume.", 6500);
        }
      }, 1400);
    };
    trackUnmuteHandler = () => {
      window.clearTimeout(trackMuteTimer);
      if (currentMode === "camera" && !document.hidden) {
        engine.resume?.();
        liveLabel.textContent = "LIVE";
      }
    };
    for (const track of stream.getVideoTracks()) {
      track.addEventListener("ended", trackEndedHandler, { once: true });
      track.addEventListener("mute", trackMuteHandler);
      track.addEventListener("unmute", trackUnmuteHandler);
    }
  }

  async function updateCameraAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameraCount = devices.filter((device) => device.kind === "videoinput").length;
      flipButton.disabled = cameraCount < 2;
      flipButton.style.opacity = cameraCount < 2 ? "0.35" : "1";
    } catch {
      flipButton.disabled = false;
    }
  }

  async function flipCamera() {
    if (currentMode === "upload") {
      videoUploadInput.click();
      return;
    }
    if (currentMode !== "camera" || isStartingCamera) return;
    facingMode = facingMode === "environment" ? "user" : "environment";
    await startCamera({ switching: true });
  }

  async function captureImage() {
    if (!engine.isRunning) return;
    captureButton.classList.remove("capturing");
    void captureButton.offsetWidth;
    captureButton.classList.add("capturing");
    navigator.vibrate?.(20);

    try {
      const blob = await engine.captureBlob();
      if (!blob) throw new Error("Empty capture");

      clearCaptureUrl();
      captureBlob = blob;
      captureUrl = URL.createObjectURL(blob);
      capturePreview.src = captureUrl;
      openDialog(captureDialog);
    } catch {
      showToast("The image could not be captured. Keep the filter open and try once more.");
    }
  }

  async function shareImage() {
    if (!captureBlob) return;
    const file = new File([captureBlob], captureFilename(), { type: "image/png" });

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My DotCam",
          text: "Made with DotCam — manu.vision/dotcam",
        });
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }

    saveImage();
  }

  function saveImage() {
    if (!captureBlob || !captureUrl) return;
    const link = document.createElement("a");
    link.href = captureUrl;
    link.download = captureFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("If no download appears, press and hold the image to save it.", 5200);
  }

  function captureFilename() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `dotcam-${stamp}.png`;
  }

  function clearCaptureUrl() {
    if (captureUrl) URL.revokeObjectURL(captureUrl);
    captureUrl = null;
    captureBlob = null;
  }

  function updateSetting(key, value) {
    settings = { ...settings, [key]: value };
    applySettings(settings, true);
  }

  function applySettings(nextSettings, persist = true) {
    settings = { ...DEFAULT_SETTINGS, ...nextSettings };
    densityInput.value = String(settings.density);
    dotSizeInput.value = String(Math.round(settings.dotSize * 10));
    trailInput.value = String(settings.trail);
    densityValue.textContent = `${settings.density}%`;
    dotSizeValue.textContent = settings.dotSize.toFixed(1);
    trailValue.textContent = `${settings.trail}%`;
    setRangeFill(densityInput);
    setRangeFill(dotSizeInput);
    setRangeFill(trailInput);
    modeLabel.textContent = settings.palette.toUpperCase();

    for (const button of paletteControl.querySelectorAll("button")) {
      const active = button.dataset.palette === settings.palette;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    engine?.updateSettings(settings);
    if (persist) saveSettings(settings);
  }

  function setRangeFill(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const fill = ((value - min) / (max - min)) * 100;
    input.style.setProperty("--fill", `${fill}%`);
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (!stored || typeof stored !== "object") return { ...DEFAULT_SETTINGS };
      return {
        density: clamp(Number(stored.density) || DEFAULT_SETTINGS.density, 25, 100),
        dotSize: clamp(Number(stored.dotSize) || DEFAULT_SETTINGS.dotSize, 0.8, 3.6),
        trail: clamp(Number.isFinite(Number(stored.trail)) ? Number(stored.trail) : DEFAULT_SETTINGS.trail, 0, 92),
        palette: ["source", "prism", "mono"].includes(stored.palette) ? stored.palette : DEFAULT_SETTINGS.palette,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(value) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
    } catch {
      // Private browsing can make storage unavailable; the live filter still works.
    }
  }

  function openDialog(dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog.open && !dialog.hasAttribute("open")) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function setLoading(visible, copy = "Opening camera…") {
    loadingCopy.textContent = copy;
    loadingState.hidden = !visible;
  }

  function showToast(message, duration = 4600) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, duration);
  }

  function isLocalAddress() {
    return ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  }

  function waitForVideo(element) {
    if (element.readyState >= 1 && element.videoWidth) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Camera timed out"));
      }, 10000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        element.removeEventListener("loadedmetadata", ready);
        element.removeEventListener("error", failed);
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("Camera could not load"));
      };
      element.addEventListener("loadedmetadata", ready, { once: true });
      element.addEventListener("error", failed, { once: true });
    });
  }

  function cameraErrorMessage(error) {
    switch (error?.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera access was blocked. Allow it in browser settings, choose a video, or preview the effect.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was found on this device. The interactive preview still works.";
      case "NotReadableError":
      case "TrackStartError":
        return "Another app may be using the camera. Close it, then try DotCam again.";
      case "AbortError":
        return "The camera stopped before it was ready. Please try again.";
      default:
        return "DotCam could not open the camera. Try the preview, or reload and grant camera access.";
    }
  }

  async function requestWakeLock() {
    if (!navigator.wakeLock || document.visibilityState !== "visible") return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    wakeLock?.release?.();
    wakeLock = null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setCameraButtonLabel(longLabel, shortLabel) {
    startCameraButton.querySelector(".long-label").textContent = longLabel;
    startCameraButton.querySelector(".short-label").textContent = shortLabel;
  }

  function shortFileName(name) {
    if (!name) return "Your video";
    return name.length > 34 ? `${name.slice(0, 31)}…` : name;
  }

  startCameraButton.addEventListener("click", () => startCamera());
  startDemoButton.addEventListener("click", startDemo);
  uploadVideoButton.addEventListener("click", () => videoUploadInput.click());
  videoUploadInput.addEventListener("change", () => startUploadedVideo(videoUploadInput.files?.[0]));
  exitDemoButton.addEventListener("click", () => startCamera());
  flipButton.addEventListener("click", flipCamera);
  captureButton.addEventListener("click", captureImage);
  settingsButton.addEventListener("click", () => openDialog(settingsDialog));
  infoButton.addEventListener("click", () => openDialog(aboutDialog));
  aboutClose.addEventListener("click", () => closeDialog(aboutDialog));
  stopCameraButton.addEventListener("click", () => {
    closeDialog(aboutDialog);
    stopEverything();
  });
  captureClose.addEventListener("click", () => closeDialog(captureDialog));
  shareCapture.addEventListener("click", shareImage);
  saveCapture.addEventListener("click", saveImage);

  densityInput.addEventListener("input", () => updateSetting("density", Number(densityInput.value)));
  dotSizeInput.addEventListener("input", () => updateSetting("dotSize", Number(dotSizeInput.value) / 10));
  trailInput.addEventListener("input", () => updateSetting("trail", Number(trailInput.value)));
  paletteControl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-palette]");
    if (button) updateSetting("palette", button.dataset.palette);
  });
  resetSettingsButton.addEventListener("click", () => applySettings({ ...DEFAULT_SETTINGS }, true));

  for (const dialog of [settingsDialog, aboutDialog, captureDialog]) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  }

  captureDialog.addEventListener("close", () => {
    window.setTimeout(clearCaptureUrl, 250);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      engine.pause?.();
      releaseWakeLock();
    } else if (currentMode !== "idle") {
      const hasLiveCamera = currentMode !== "camera" || Boolean(
        stream?.active && stream.getVideoTracks().some((track) => track.readyState === "live"),
      );
      if (hasLiveCamera) {
        if (currentMode === "upload") {
          video.play().then(() => engine.resume?.()).catch(() => {
            liveLabel.textContent = "PAUSED";
            showToast("Tap Change to choose the video again if playback does not resume.", 6000);
          });
        } else {
          engine.resume?.();
        }
        requestWakeLock();
      } else {
        stopStream();
        currentMode = "idle";
        deactivateCameraUi();
        setCameraButtonLabel("Restart camera", "Restart");
        showToast("The camera was interrupted. Tap Restart camera to reconnect.", 7000);
      }
    }
  });

  window.addEventListener("resize", () => engine.resize(), { passive: true });
  window.addEventListener("orientationchange", () => window.setTimeout(() => engine.resize(), 180), { passive: true });
  window.addEventListener("pagehide", stopEverything, { once: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === " " && currentMode !== "idle" && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      captureImage();
    }
    if (event.key.toLowerCase() === "s" && currentMode !== "idle") openDialog(settingsDialog);
    if (event.key.toLowerCase() === "d" && currentMode === "idle") startDemo();
    if (event.key.toLowerCase() === "u") videoUploadInput.click();
  });

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settings = { ...settings, trail: Math.min(settings.trail, 42) };
    applySettings(settings, false);
  }
})();
