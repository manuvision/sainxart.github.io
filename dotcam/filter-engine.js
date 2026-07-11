(() => {
  "use strict";

  const TWO_PI = Math.PI * 2;

  class DotFilterEngine {
    constructor({ sourceCanvas, outputCanvas, onStats } = {}) {
      if (!sourceCanvas || !outputCanvas) {
        throw new Error("DotFilterEngine needs source and output canvases.");
      }

      this.sourceCanvas = sourceCanvas;
      this.outputCanvas = outputCanvas;
      this.sourceContext = sourceCanvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });
      this.outputContext = outputCanvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      this.onStats = typeof onStats === "function" ? onStats : () => {};

      this.settings = {
        density: 72,
        dotSize: 1.8,
        trail: 64,
        palette: "prism",
      };

      this.source = null;
      this.beforeFrame = null;
      this.mirror = false;
      this.isRunning = false;
      this.isPaused = false;
      this.analysisWidth = 0;
      this.analysisHeight = 0;
      this.outputDpr = 1;
      this.tracks = [];
      this.nextTrackId = 1;
      this.hasPreviousFrame = false;
      this.frameNumber = 0;
      this.lastFrameTime = 0;
      this.lastStatsTime = 0;
      this.statsFrameCount = 0;
      this.fps = 0;
      this.currentPixels = null;
      this.currentGray = new Uint8Array(0);
      this.previousGray = new Uint8Array(0);
      this.gradientX = new Float32Array(0);
      this.gradientY = new Float32Array(0);
      this.videoFrameHandle = 0;
      this.animationFrameHandle = 0;
      this.needsDetection = true;
      this.resizeQueued = false;

      this.boundAnimationLoop = (time) => this.animationLoop(time);
      this.boundVideoLoop = (time) => this.videoLoop(time);
      this.resize();
    }

    start(sourceElement, { mirror = false, beforeFrame = null } = {}) {
      if (!sourceElement) throw new Error("A video or canvas source is required.");

      this.cancelScheduledFrame();
      this.source = sourceElement;
      this.mirror = Boolean(mirror);
      this.beforeFrame = typeof beforeFrame === "function" ? beforeFrame : null;
      this.isRunning = true;
      this.isPaused = false;
      this.lastFrameTime = 0;
      this.reset();
      this.resize();
      this.scheduleNextFrame();
    }

    stop() {
      this.cancelScheduledFrame();
      this.isRunning = false;
      this.isPaused = false;
      this.source = null;
      this.beforeFrame = null;
    }

    pause() {
      if (!this.isRunning) return;
      this.isPaused = true;
    }

    resume() {
      if (!this.isRunning) return;
      this.isPaused = false;
      this.hasPreviousFrame = false;
      this.needsDetection = true;
      this.lastFrameTime = 0;
    }

    reset() {
      this.tracks.length = 0;
      this.hasPreviousFrame = false;
      this.frameNumber = 0;
      this.nextTrackId = 1;
      this.needsDetection = true;
      this.clearOutput();
    }

    updateSettings(nextSettings = {}) {
      const oldDensity = this.settings.density;
      this.settings.density = clamp(Number(nextSettings.density) || 72, 25, 100);
      this.settings.dotSize = clamp(Number(nextSettings.dotSize) || 1.8, 0.8, 3.6);
      this.settings.trail = clamp(Number.isFinite(Number(nextSettings.trail)) ? Number(nextSettings.trail) : 64, 0, 92);
      this.settings.palette = ["source", "prism", "mono"].includes(nextSettings.palette)
        ? nextSettings.palette
        : this.settings.palette;

      if (oldDensity !== this.settings.density) {
        this.needsDetection = true;
        const target = this.targetPointCount();
        if (this.tracks.length > target) {
          this.tracks.sort((a, b) => b.quality * b.life - a.quality * a.life);
          this.tracks.length = target;
        }
      }
    }

    resize() {
      if (this.resizeQueued) return;
      this.resizeQueued = true;

      const applyResize = () => {
        this.resizeQueued = false;
        const rect = this.outputCanvas.getBoundingClientRect();
        const cssWidth = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
        const cssHeight = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const outputWidth = Math.max(1, Math.round(cssWidth * dpr));
        const outputHeight = Math.max(1, Math.round(cssHeight * dpr));

        let shortSide = 210;
        let analysisWidth;
        let analysisHeight;
        const aspect = cssWidth / cssHeight;

        if (aspect >= 1) {
          analysisHeight = shortSide;
          analysisWidth = Math.round(shortSide * aspect);
          if (analysisWidth > 384) {
            analysisHeight = Math.round(analysisHeight * (384 / analysisWidth));
            analysisWidth = 384;
          }
        } else {
          analysisWidth = shortSide;
          analysisHeight = Math.round(shortSide / aspect);
          if (analysisHeight > 384) {
            analysisWidth = Math.round(analysisWidth * (384 / analysisHeight));
            analysisHeight = 384;
          }
        }

        analysisWidth = Math.max(128, analysisWidth);
        analysisHeight = Math.max(128, analysisHeight);
        const outputChanged = this.outputCanvas.width !== outputWidth || this.outputCanvas.height !== outputHeight;
        const analysisChanged = this.analysisWidth !== analysisWidth || this.analysisHeight !== analysisHeight;

        this.outputDpr = dpr;
        if (outputChanged) {
          this.outputCanvas.width = outputWidth;
          this.outputCanvas.height = outputHeight;
          this.clearOutput();
        }

        if (analysisChanged) {
          this.analysisWidth = analysisWidth;
          this.analysisHeight = analysisHeight;
          this.sourceCanvas.width = analysisWidth;
          this.sourceCanvas.height = analysisHeight;
          const size = analysisWidth * analysisHeight;
          this.currentGray = new Uint8Array(size);
          this.previousGray = new Uint8Array(size);
          this.gradientX = new Float32Array(size);
          this.gradientY = new Float32Array(size);
          this.tracks.length = 0;
          this.hasPreviousFrame = false;
          this.needsDetection = true;
        }
      };

      // ResizeObserver-style bursts are collapsed without delaying the first setup.
      applyResize();
    }

    async captureBlob() {
      if (!this.outputCanvas.width || !this.outputCanvas.height) return null;

      const sourceWidth = this.outputCanvas.width;
      const sourceHeight = this.outputCanvas.height;
      const aspect = sourceWidth / sourceHeight;
      let width;
      let height;

      if (aspect >= 1) {
        width = 1920;
        height = Math.round(width / aspect);
        if (height > 1440) {
          height = 1440;
          width = Math.round(height * aspect);
        }
      } else {
        height = 1920;
        width = Math.round(height * aspect);
        if (width > 1440) {
          width = 1440;
          height = Math.round(width / aspect);
        }
      }

      width = Math.max(640, width);
      height = Math.max(640, height);
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const context = exportCanvas.getContext("2d", { alpha: false });
      context.fillStyle = "#050608";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(this.outputCanvas, 0, 0, width, height);

      const edge = Math.round(Math.min(width, height) * 0.045);
      const labelSize = Math.max(14, Math.round(Math.min(width, height) * 0.017));
      const dotRadius = Math.max(2, Math.round(labelSize * 0.17));
      const label = "DOTCAM  ·  MANU.VISION";
      context.save();
      context.font = `700 ${labelSize}px ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif`;
      context.letterSpacing = `${Math.round(labelSize * 0.14)}px`;
      const textWidth = context.measureText(label).width;
      const pillHeight = labelSize * 2.45;
      const pillWidth = textWidth + labelSize * 3.8;
      const x = width - edge - pillWidth;
      const y = height - edge - pillHeight;
      roundedRect(context, x, y, pillWidth, pillHeight, pillHeight / 2);
      context.fillStyle = "rgba(5, 6, 8, .58)";
      context.fill();
      context.strokeStyle = "rgba(255,255,255,.2)";
      context.lineWidth = Math.max(1, width / 1100);
      context.stroke();
      context.fillStyle = "#d9ff69";
      context.beginPath();
      context.arc(x + labelSize * 1.25, y + pillHeight / 2, dotRadius, 0, TWO_PI);
      context.fill();
      context.fillStyle = "rgba(255,255,255,.78)";
      context.textBaseline = "middle";
      context.fillText(label, x + labelSize * 2.1, y + pillHeight / 2 + 1);
      context.restore();

      return canvasToBlob(exportCanvas, "image/png");
    }

    scheduleNextFrame() {
      if (!this.isRunning || !this.source) return;
      const isVideo = typeof HTMLVideoElement !== "undefined" && this.source instanceof HTMLVideoElement;

      if (isVideo && typeof this.source.requestVideoFrameCallback === "function") {
        this.videoFrameHandle = this.source.requestVideoFrameCallback(this.boundVideoLoop);
      } else {
        this.animationFrameHandle = requestAnimationFrame(this.boundAnimationLoop);
      }
    }

    cancelScheduledFrame() {
      if (this.animationFrameHandle) cancelAnimationFrame(this.animationFrameHandle);
      if (this.videoFrameHandle && this.source?.cancelVideoFrameCallback) {
        this.source.cancelVideoFrameCallback(this.videoFrameHandle);
      }
      this.animationFrameHandle = 0;
      this.videoFrameHandle = 0;
    }

    videoLoop(time) {
      this.videoFrameHandle = 0;
      if (!this.isRunning) return;
      if (!this.isPaused) this.processFrame(time);
      this.scheduleNextFrame();
    }

    animationLoop(time) {
      this.animationFrameHandle = 0;
      if (!this.isRunning) return;
      if (!this.isPaused && (this.lastFrameTime === 0 || time - this.lastFrameTime >= 32)) {
        this.processFrame(time);
      }
      this.scheduleNextFrame();
    }

    processFrame(time) {
      const frameStart = performance.now();
      this.lastFrameTime = time;
      this.beforeFrame?.(time);

      if (!this.drawSourceFrame()) return;

      const imageData = this.sourceContext.getImageData(0, 0, this.analysisWidth, this.analysisHeight);
      this.currentPixels = imageData.data;
      this.convertToLuminance(this.currentPixels, this.currentGray);

      if (this.hasPreviousFrame && this.tracks.length) {
        this.trackFeatures();
      }

      const target = this.targetPointCount();
      const detectionInterval = this.settings.density > 82 ? 5 : 7;
      if (
        !this.hasPreviousFrame ||
        this.needsDetection ||
        this.frameNumber % detectionInterval === 0 ||
        this.tracks.length < target * 0.7
      ) {
        this.seedFeatures(target);
        this.needsDetection = false;
      }

      this.render(time);
      this.swapGrayBuffers();
      this.hasPreviousFrame = true;
      this.frameNumber += 1;
      this.updateStats(time, performance.now() - frameStart);
    }

    drawSourceFrame() {
      const source = this.source;
      const sourceWidth = source?.videoWidth || source?.naturalWidth || source?.width || 0;
      const sourceHeight = source?.videoHeight || source?.naturalHeight || source?.height || 0;
      if (!sourceWidth || !sourceHeight || !this.analysisWidth || !this.analysisHeight) return false;

      const scale = Math.max(this.analysisWidth / sourceWidth, this.analysisHeight / sourceHeight);
      const cropWidth = this.analysisWidth / scale;
      const cropHeight = this.analysisHeight / scale;
      const cropX = (sourceWidth - cropWidth) * 0.5;
      const cropY = (sourceHeight - cropHeight) * 0.5;
      const context = this.sourceContext;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#050608";
      context.fillRect(0, 0, this.analysisWidth, this.analysisHeight);

      try {
        if (this.mirror) {
          context.save();
          context.translate(this.analysisWidth, 0);
          context.scale(-1, 1);
          context.drawImage(
            source,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            this.analysisWidth,
            this.analysisHeight,
          );
          context.restore();
        } else {
          context.drawImage(
            source,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            this.analysisWidth,
            this.analysisHeight,
          );
        }
      } catch {
        context.setTransform(1, 0, 0, 1, 0, 0);
        return false;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      return true;
    }

    convertToLuminance(pixels, target) {
      for (let sourceIndex = 0, grayIndex = 0; grayIndex < target.length; sourceIndex += 4, grayIndex += 1) {
        target[grayIndex] = (77 * pixels[sourceIndex] + 150 * pixels[sourceIndex + 1] + 29 * pixels[sourceIndex + 2]) >> 8;
      }
    }

    trackFeatures() {
      const width = this.analysisWidth;
      const height = this.analysisHeight;
      const previous = this.previousGray;
      const current = this.currentGray;
      const radius = 3;
      const border = radius + 3;

      for (const point of this.tracks) {
        if (point.life <= 0) continue;
        if (point.x < border || point.y < border || point.x >= width - border || point.y >= height - border) {
          point.life = 0;
          continue;
        }

        let flowX = clamp(point.vx * 0.35, -2, 2);
        let flowY = clamp(point.vy * 0.35, -2, 2);
        let determinant = 0;
        let error = 0;
        let valid = true;

        for (let iteration = 0; iteration < 2; iteration += 1) {
          let sumXX = 0;
          let sumXY = 0;
          let sumYY = 0;
          let sumXT = 0;
          let sumYT = 0;
          let errorSum = 0;
          let samples = 0;

          for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
            for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
              const previousX = point.x + offsetX;
              const previousY = point.y + offsetY;
              const currentX = previousX + flowX;
              const currentY = previousY + flowY;

              if (currentX < 1 || currentY < 1 || currentX >= width - 2 || currentY >= height - 2) {
                valid = false;
                break;
              }

              const previousValue = bilinear(previous, width, height, previousX, previousY);
              const currentValue = bilinear(current, width, height, currentX, currentY);
              const gradientX = (
                bilinear(previous, width, height, previousX + 1, previousY) -
                bilinear(previous, width, height, previousX - 1, previousY) +
                bilinear(current, width, height, currentX + 1, currentY) -
                bilinear(current, width, height, currentX - 1, currentY)
              ) * 0.25;
              const gradientY = (
                bilinear(previous, width, height, previousX, previousY + 1) -
                bilinear(previous, width, height, previousX, previousY - 1) +
                bilinear(current, width, height, currentX, currentY + 1) -
                bilinear(current, width, height, currentX, currentY - 1)
              ) * 0.25;
              const temporal = currentValue - previousValue;

              sumXX += gradientX * gradientX;
              sumXY += gradientX * gradientY;
              sumYY += gradientY * gradientY;
              sumXT += gradientX * temporal;
              sumYT += gradientY * temporal;
              errorSum += Math.abs(temporal);
              samples += 1;
            }
            if (!valid) break;
          }

          if (!valid || !samples) break;
          determinant = sumXX * sumYY - sumXY * sumXY;
          error = errorSum / samples;
          const trace = sumXX + sumYY;

          if (determinant < Math.max(1800, trace * trace * 0.002)) {
            valid = false;
            break;
          }

          const moveX = (-sumYY * sumXT + sumXY * sumYT) / determinant;
          const moveY = (sumXY * sumXT - sumXX * sumYT) / determinant;
          flowX += clamp(moveX, -2.4, 2.4);
          flowY += clamp(moveY, -2.4, 2.4);

          if (moveX * moveX + moveY * moveY < 0.012) break;
          if (flowX * flowX + flowY * flowY > 100) {
            valid = false;
            break;
          }
        }

        if (!valid || error > 58 || !Number.isFinite(flowX + flowY)) {
          point.life -= 0.38;
          point.alpha *= 0.84;
          continue;
        }

        point.vx = point.vx * 0.48 + flowX * 0.52;
        point.vy = point.vy * 0.48 + flowY * 0.52;
        point.x += point.vx;
        point.y += point.vy;
        point.displayX += (point.x - point.displayX) * 0.62;
        point.displayY += (point.y - point.displayY) * 0.62;
        point.life = Math.min(1, point.life + 0.06);
        point.alpha = Math.min(1, point.alpha + 0.13);
        point.age += 1;
        point.quality = point.quality * 0.97 + Math.min(1, determinant / 18000000) * 0.03;
        this.samplePointColor(point);

        if (
          point.x < border ||
          point.y < border ||
          point.x >= width - border ||
          point.y >= height - border ||
          point.age > 540
        ) {
          point.life -= point.age > 540 ? 0.1 : 1;
        }
      }

      this.tracks = this.tracks.filter((point) => point.life > 0.04 && Number.isFinite(point.x + point.y));
    }

    seedFeatures(targetCount) {
      const width = this.analysisWidth;
      const height = this.analysisHeight;
      const size = width * height;
      const current = this.currentGray;
      const gx = this.gradientX;
      const gy = this.gradientY;
      gx.fill(0);
      gy.fill(0);

      for (let y = 1; y < height - 1; y += 1) {
        let index = y * width + 1;
        for (let x = 1; x < width - 1; x += 1, index += 1) {
          gx[index] = (current[index + 1] - current[index - 1]) * 0.5;
          gy[index] = (current[index + width] - current[index - width]) * 0.5;
        }
      }

      const cellSize = clamp(Math.round(Math.sqrt(size / Math.max(1, targetCount)) * 0.92), 6, 13);
      const cellsX = Math.ceil(width / cellSize);
      const cellsY = Math.ceil(height / cellSize);
      const cellCount = cellsX * cellsY;
      const bestScore = new Float32Array(cellCount);
      const bestX = new Int16Array(cellCount);
      const bestY = new Int16Array(cellCount);
      let frameMaximum = 0;
      const windowRadius = 2;

      for (let y = 4; y < height - 4; y += 2) {
        for (let x = 4; x < width - 4; x += 2) {
          let sumXX = 0;
          let sumXY = 0;
          let sumYY = 0;

          for (let windowY = -windowRadius; windowY <= windowRadius; windowY += 1) {
            let index = (y + windowY) * width + x - windowRadius;
            for (let windowX = -windowRadius; windowX <= windowRadius; windowX += 1, index += 1) {
              const gradientX = gx[index];
              const gradientY = gy[index];
              sumXX += gradientX * gradientX;
              sumXY += gradientX * gradientY;
              sumYY += gradientY * gradientY;
            }
          }

          const trace = sumXX + sumYY;
          const difference = sumXX - sumYY;
          const lambdaMin = Math.max(0, (trace - Math.sqrt(difference * difference + 4 * sumXY * sumXY)) * 0.5);
          // A small trace contribution preserves the dense edge constellation of the reference.
          const score = lambdaMin + trace * 0.026;
          const cellIndex = Math.floor(y / cellSize) * cellsX + Math.floor(x / cellSize);
          if (score > bestScore[cellIndex]) {
            bestScore[cellIndex] = score;
            bestX[cellIndex] = x;
            bestY[cellIndex] = y;
          }
          if (score > frameMaximum) frameMaximum = score;
        }
      }

      if (!frameMaximum) return;
      const threshold = frameMaximum * 0.018;
      const candidates = [];
      for (let index = 0; index < cellCount; index += 1) {
        if (bestScore[index] >= threshold) {
          candidates.push({
            x: bestX[index],
            y: bestY[index],
            score: bestScore[index],
          });
        }
      }
      candidates.sort((a, b) => b.score - a.score);

      const occupancy = new Uint8Array(cellCount);
      for (const point of this.tracks) {
        if (point.life <= 0.1) continue;
        markOccupied(occupancy, cellsX, cellsY, cellSize, point.x, point.y);
      }

      for (const candidate of candidates) {
        if (this.tracks.length >= targetCount) break;
        const cellX = Math.floor(candidate.x / cellSize);
        const cellY = Math.floor(candidate.y / cellSize);
        const cellIndex = cellY * cellsX + cellX;
        if (occupancy[cellIndex]) continue;

        const normalizedQuality = Math.sqrt(candidate.score / frameMaximum);
        const point = {
          id: this.nextTrackId,
          x: candidate.x,
          y: candidate.y,
          displayX: candidate.x,
          displayY: candidate.y,
          vx: 0,
          vy: 0,
          r: 190,
          g: 210,
          b: 205,
          alpha: 0.08,
          life: 1,
          age: 0,
          quality: normalizedQuality,
          twinkle: ((this.nextTrackId * 47) % 100) / 100,
        };
        this.nextTrackId += 1;
        this.samplePointColor(point, true);
        this.tracks.push(point);
        markOccupied(occupancy, cellsX, cellsY, cellSize, candidate.x, candidate.y);
      }

      if (this.tracks.length > targetCount) {
        this.tracks.sort((a, b) => b.life * b.quality - a.life * a.quality);
        this.tracks.length = targetCount;
      }
    }

    samplePointColor(point, immediate = false) {
      const width = this.analysisWidth;
      const height = this.analysisHeight;
      const centerX = clamp(Math.round(point.x), 1, width - 2);
      const centerY = clamp(Math.round(point.y), 1, height - 2);
      let red = 0;
      let green = 0;
      let blue = 0;
      let samples = 0;

      for (let y = -1; y <= 1; y += 1) {
        for (let x = -1; x <= 1; x += 1) {
          const index = ((centerY + y) * width + centerX + x) * 4;
          red += this.currentPixels[index];
          green += this.currentPixels[index + 1];
          blue += this.currentPixels[index + 2];
          samples += 1;
        }
      }

      red /= samples;
      green /= samples;
      blue /= samples;
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      const colorBoost = luminance < 92 ? 92 / Math.max(24, luminance) : 1;
      red = clamp(red * colorBoost * 1.06, 0, 255);
      green = clamp(green * colorBoost * 1.06, 0, 255);
      blue = clamp(blue * colorBoost * 1.06, 0, 255);

      const amount = immediate ? 1 : 0.2;
      point.r += (red - point.r) * amount;
      point.g += (green - point.g) * amount;
      point.b += (blue - point.b) * amount;
    }

    render(time) {
      const context = this.outputContext;
      const outputWidth = this.outputCanvas.width;
      const outputHeight = this.outputCanvas.height;
      if (!outputWidth || !outputHeight) return;

      const fadeAlpha = 0.035 + (1 - this.settings.trail / 100) * 0.72;
      context.globalCompositeOperation = "source-over";
      context.fillStyle = `rgba(4, 5, 7, ${clamp(fadeAlpha, 0.04, 1)})`;
      context.fillRect(0, 0, outputWidth, outputHeight);

      const scaleX = outputWidth / this.analysisWidth;
      const scaleY = outputHeight / this.analysisHeight;
      const baseRadius = this.settings.dotSize * this.outputDpr;
      const seconds = time * 0.001;
      context.globalCompositeOperation = "lighter";

      for (const point of this.tracks) {
        const shimmer = 0.83 + Math.sin(seconds * 2.2 + point.twinkle * TWO_PI + point.age * 0.022) * 0.17;
        const alpha = clamp(point.alpha * point.life * shimmer, 0, 1);
        if (alpha < 0.02) continue;

        const x = point.displayX * scaleX;
        const y = point.displayY * scaleY;
        const radius = baseRadius * (0.72 + point.quality * 0.58 + point.twinkle * 0.14);
        const color = this.pointColor(point, seconds);

        context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.11})`;
        context.beginPath();
        context.arc(x, y, radius * 2.55, 0, TWO_PI);
        context.fill();

        context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.9})`;
        context.beginPath();
        context.arc(x, y, radius, 0, TWO_PI);
        context.fill();
      }

      context.globalCompositeOperation = "source-over";
    }

    pointColor(point, seconds) {
      let red = point.r;
      let green = point.g;
      let blue = point.b;

      if (this.settings.palette === "mono") {
        const light = clamp(0.3 * red + 0.58 * green + 0.12 * blue, 120, 248);
        red = light * 0.91;
        green = light * 0.98;
        blue = Math.min(255, light * 1.02 + 7);
      } else if (this.settings.palette === "prism") {
        const phase = point.x * 0.024 + point.y * 0.011 + seconds * 0.22 + point.twinkle * 2.5;
        const prismRed = 150 + 105 * Math.sin(phase);
        const prismGreen = 150 + 105 * Math.sin(phase + 2.09);
        const prismBlue = 150 + 105 * Math.sin(phase + 4.18);
        red = red * 0.62 + prismRed * 0.38;
        green = green * 0.62 + prismGreen * 0.38;
        blue = blue * 0.62 + prismBlue * 0.38;
      }

      const maximum = Math.max(red, green, blue);
      if (maximum < 150) {
        const boost = 150 / Math.max(1, maximum);
        red *= boost;
        green *= boost;
        blue *= boost;
      }

      return [Math.round(clamp(red, 0, 255)), Math.round(clamp(green, 0, 255)), Math.round(clamp(blue, 0, 255))];
    }

    targetPointCount() {
      const density = this.settings.density / 100;
      const areaScale = Math.sqrt((this.analysisWidth * this.analysisHeight) / (210 * 360));
      return Math.round(clamp((230 + density * 900) * areaScale, 260, 1150));
    }

    swapGrayBuffers() {
      const previous = this.previousGray;
      this.previousGray = this.currentGray;
      this.currentGray = previous;
    }

    updateStats(time, workTime) {
      this.statsFrameCount += 1;
      if (!this.lastStatsTime) this.lastStatsTime = time;
      const elapsed = time - this.lastStatsTime;
      if (elapsed < 500) return;

      this.fps = (this.statsFrameCount * 1000) / Math.max(1, elapsed);
      this.statsFrameCount = 0;
      this.lastStatsTime = time;
      this.onStats({
        pointCount: this.tracks.length,
        fps: Math.round(this.fps),
        workTime: Math.round(workTime * 10) / 10,
      });
    }

    clearOutput() {
      if (!this.outputContext || !this.outputCanvas.width || !this.outputCanvas.height) return;
      this.outputContext.setTransform(1, 0, 0, 1, 0, 0);
      this.outputContext.globalCompositeOperation = "source-over";
      this.outputContext.fillStyle = "#050608";
      this.outputContext.fillRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }
  }

  function bilinear(buffer, width, height, x, y) {
    const clampedX = clamp(x, 0, width - 1.001);
    const clampedY = clamp(y, 0, height - 1.001);
    const x0 = clampedX | 0;
    const y0 = clampedY | 0;
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fractionX = clampedX - x0;
    const fractionY = clampedY - y0;
    const top = buffer[y0 * width + x0] * (1 - fractionX) + buffer[y0 * width + x1] * fractionX;
    const bottom = buffer[y1 * width + x0] * (1 - fractionX) + buffer[y1 * width + x1] * fractionX;
    return top * (1 - fractionY) + bottom * fractionY;
  }

  function markOccupied(occupancy, cellsX, cellsY, cellSize, x, y) {
    const centerX = Math.floor(x / cellSize);
    const centerY = Math.floor(y / cellSize);
    if (centerX >= 0 && centerX < cellsX && centerY >= 0 && centerY < cellsY) {
      occupancy[centerY * cellsX + centerX] = 1;
    }
  }

  function roundedRect(context, x, y, width, height, radius) {
    if (typeof context.roundRect === "function") {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      return;
    }

    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function canvasToBlob(canvas, type) {
    return new Promise((resolve) => {
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob(resolve, type, 1);
        return;
      }

      const dataUrl = canvas.toDataURL(type, 1);
      const parts = dataUrl.split(",");
      const bytes = atob(parts[1]);
      const buffer = new Uint8Array(bytes.length);
      for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
      resolve(new Blob([buffer], { type }));
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.DotFilterEngine = DotFilterEngine;
})();
