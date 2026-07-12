(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const PYRAMID_LEVELS = 3;
  const MAX_TEMPLATE_SAMPLES = 81;
  const MIN_VISIBLE_AGE = 3;

  class DotFilterEngine {
    constructor({ sourceCanvas, outputCanvas, onStats } = {}) {
      if (!sourceCanvas || !outputCanvas) {
        throw new Error("DotFilterEngine needs source and output canvases.");
      }

      this.sourceCanvas = sourceCanvas;
      this.outputCanvas = outputCanvas;
      this.frameCanvas = document.createElement("canvas");
      this.sourceContext = sourceCanvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
      });
      this.frameContext = this.frameCanvas.getContext("2d", { alpha: false });
      this.outputContext = outputCanvas.getContext("2d", { alpha: false });
      this.onStats = typeof onStats === "function" ? onStats : () => {};

      this.settings = {
        density: 84,
        dotSize: 2.4,
        palette: "source",
      };

      this.source = null;
      this.beforeFrame = null;
      this.mirror = false;
      this.isRunning = false;
      this.isPaused = false;
      this.analysisWidth = 0;
      this.analysisHeight = 0;
      this.outputDpr = 1;
      this.lastCssWidth = 0;
      this.lastCssHeight = 0;
      this.tracks = [];
      this.nextTracks = [];
      this.provisionalTracks = [];
      this.failedTracks = [];
      this.flowValuesX = [];
      this.flowValuesY = [];
      this.nextTrackId = 1;
      this.hasPreviousFrame = false;
      this.frameNumber = 0;
      this.lastDetectionFrame = -1000;
      this.lastFrameTime = 0;
      this.lastMediaTime = null;
      this.lastStatsTime = 0;
      this.statsFrameCount = 0;
      this.fps = 0;
      this.workTimeEma = 0;
      this.performanceScale = 1;
      this.overBudgetFrames = 0;
      this.underBudgetFrames = 0;
      this.currentPixels = null;
      this.currentPyramid = [];
      this.previousPyramid = [];
      this.gradientX = new Float32Array(0);
      this.gradientY = new Float32Array(0);
      this.templateValues = new Float32Array(MAX_TEMPLATE_SAMPLES);
      this.templateGradientX = new Float32Array(MAX_TEMPLATE_SAMPLES);
      this.templateGradientY = new Float32Array(MAX_TEMPLATE_SAMPLES);
      this.templateOffsetX = new Int8Array(MAX_TEMPLATE_SAMPLES);
      this.templateOffsetY = new Int8Array(MAX_TEMPLATE_SAMPLES);
      this.residuals = new Float32Array(MAX_TEMPLATE_SAMPLES);
      this.flowScratch = createFlowResult();
      this.backwardScratch = createFlowResult();
      this.templateScratch = createTemplateResult();
      this.displacementScratch = { x: 0, y: 0 };
      this.colorScratch = new Uint8Array(3);
      this.globalModel = identitySimilarity();
      this.previousGlobalModel = identitySimilarity();
      this.lastTrackingStats = {
        retainedRatio: 1,
        directRatio: 1,
        dropped: 0,
        retried: 0,
        predicted: 0,
        visibleRatio: 1,
        visibleDropped: 0,
      };
      this.videoFrameHandle = 0;
      this.animationFrameHandle = 0;
      this.needsDetection = true;
      this.resizeQueued = false;
      this.resizeTimer = 0;
      this.hasPresentedFrame = false;
      this.presentationHoldFrames = 0;
      this.lastPresentedPointCount = 0;
      this.outputCanvas.dataset.presentation = "buffered";

      this.boundAnimationLoop = (time) => this.animationLoop(time);
      this.boundVideoLoop = (time, metadata) => this.videoLoop(time, metadata);
      this.resize(true);
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
      this.lastMediaTime = null;
      this.reset();
      this.resize(true);
      this.scheduleNextFrame();
    }

    stop() {
      this.cancelScheduledFrame();
      this.isRunning = false;
      this.isPaused = false;
      this.source = null;
      this.beforeFrame = null;
      this.lastMediaTime = null;
    }

    pause() {
      if (!this.isRunning) return;
      this.isPaused = true;
    }

    resume() {
      if (!this.isRunning) return;
      this.isPaused = false;
      this.lastFrameTime = 0;
      this.lastMediaTime = null;
      this.resetTracking();
    }

    reset() {
      this.performanceScale = 1;
      this.workTimeEma = 0;
      this.overBudgetFrames = 0;
      this.underBudgetFrames = 0;
      this.nextTrackId = 1;
      this.frameNumber = 0;
      this.lastDetectionFrame = -1000;
      this.resetTracking();
      this.clearOutput();
    }

    resetTracking() {
      this.tracks.length = 0;
      this.nextTracks.length = 0;
      this.provisionalTracks.length = 0;
      this.failedTracks.length = 0;
      this.hasPreviousFrame = false;
      this.needsDetection = true;
      this.globalModel = identitySimilarity(this.globalModel);
      this.previousGlobalModel = identitySimilarity(this.previousGlobalModel);
    }

    updateSettings(nextSettings = {}) {
      const previousDensity = this.settings.density;
      this.settings.density = clamp(Number(nextSettings.density) || 84, 25, 100);
      this.settings.dotSize = clamp(Number(nextSettings.dotSize) || 2.4, 1.2, 3.8);
      this.settings.palette = ["source", "prism", "mono"].includes(nextSettings.palette)
        ? nextSettings.palette
        : this.settings.palette;

      if (previousDensity !== this.settings.density) {
        this.needsDetection = true;
        this.trimToTarget();
      }
    }

    resize(force = false) {
      if (force || !this.analysisWidth || !this.analysisHeight) {
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = 0;
        this.resizeQueued = false;
        this.applyResize(force);
        return;
      }

      window.clearTimeout(this.resizeTimer);
      this.resizeQueued = true;
      this.resizeTimer = window.setTimeout(() => {
        this.resizeTimer = 0;
        this.resizeQueued = false;
        this.applyResize(false);
      }, 160);
    }

    applyResize(force = false) {

      const rect = this.outputCanvas.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
      const cssHeight = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
      const previousCssWidth = this.lastCssWidth;
      const previousCssHeight = this.lastCssHeight;
      if (
        !force &&
        previousCssWidth &&
        Math.abs(cssWidth - previousCssWidth) <= 2 &&
        Math.abs(cssHeight - previousCssHeight) <= 2
      ) return;
      const preserveAnalysis = Boolean(
        this.analysisWidth &&
        previousCssWidth &&
        Math.abs(cssWidth - previousCssWidth) <= 2 &&
        Math.abs(cssHeight - previousCssHeight) / Math.max(1, previousCssHeight) < 0.2
      );
      this.lastCssWidth = cssWidth;
      this.lastCssHeight = cssHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const outputWidth = Math.max(1, Math.round(cssWidth * dpr));
      const outputHeight = Math.max(1, Math.round(cssHeight * dpr));
      const aspect = cssWidth / cssHeight;
      const shortSide = 256;
      const longSideLimit = 448;
      let analysisWidth;
      let analysisHeight;

      if (aspect >= 1) {
        analysisHeight = shortSide;
        analysisWidth = Math.round(shortSide * aspect);
        if (analysisWidth > longSideLimit) {
          analysisHeight = Math.round(analysisHeight * (longSideLimit / analysisWidth));
          analysisWidth = longSideLimit;
        }
      } else {
        analysisWidth = shortSide;
        analysisHeight = Math.round(shortSide / aspect);
        if (analysisHeight > longSideLimit) {
          analysisWidth = Math.round(analysisWidth * (longSideLimit / analysisHeight));
          analysisHeight = longSideLimit;
        }
      }

      analysisWidth = Math.max(144, analysisWidth);
      analysisHeight = Math.max(144, analysisHeight);
      if (preserveAnalysis) {
        analysisWidth = this.analysisWidth;
        analysisHeight = this.analysisHeight;
      }
      const outputChanged = this.outputCanvas.width !== outputWidth || this.outputCanvas.height !== outputHeight;
      const frameChanged = this.frameCanvas.width !== outputWidth || this.frameCanvas.height !== outputHeight;
      const analysisChanged = this.analysisWidth !== analysisWidth || this.analysisHeight !== analysisHeight;
      let previousFrame = null;

      if ((outputChanged || frameChanged) && this.hasPresentedFrame && this.outputCanvas.width && this.outputCanvas.height) {
        previousFrame = document.createElement("canvas");
        previousFrame.width = this.outputCanvas.width;
        previousFrame.height = this.outputCanvas.height;
        previousFrame.getContext("2d", { alpha: false }).drawImage(this.outputCanvas, 0, 0);
      }

      this.outputDpr = dpr;
      if (outputChanged) {
        this.outputCanvas.width = outputWidth;
        this.outputCanvas.height = outputHeight;
      }
      if (frameChanged) {
        this.frameCanvas.width = outputWidth;
        this.frameCanvas.height = outputHeight;
      }
      if (outputChanged || frameChanged) {
        if (previousFrame) {
          this.frameContext.drawImage(previousFrame, 0, 0, outputWidth, outputHeight);
          this.outputContext.globalCompositeOperation = "copy";
          this.outputContext.drawImage(this.frameCanvas, 0, 0);
          this.outputContext.globalCompositeOperation = "source-over";
        } else {
          this.clearOutput();
        }
      }

      if (analysisChanged) {
        this.analysisWidth = analysisWidth;
        this.analysisHeight = analysisHeight;
        this.sourceCanvas.width = analysisWidth;
        this.sourceCanvas.height = analysisHeight;
        this.currentPyramid = allocatePyramid(analysisWidth, analysisHeight, PYRAMID_LEVELS);
        this.previousPyramid = allocatePyramid(analysisWidth, analysisHeight, PYRAMID_LEVELS);
        this.gradientX = new Float32Array(analysisWidth * analysisHeight);
        this.gradientY = new Float32Array(analysisWidth * analysisHeight);
        this.resetTracking();
      }

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
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(this.outputCanvas, 0, 0, width, height);
      drawWatermark(context, width, height);
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

    videoLoop(time, metadata) {
      this.videoFrameHandle = 0;
      if (!this.isRunning) return;

      const mediaTime = Number(metadata?.mediaTime);
      if (Number.isFinite(mediaTime)) {
        if (this.lastMediaTime !== null) {
          const mediaDelta = mediaTime - this.lastMediaTime;
          if (mediaDelta < -0.001 || mediaDelta > 2) this.resetTracking();
        }
        this.lastMediaTime = mediaTime;
      }

      if (!this.isPaused && (this.lastFrameTime === 0 || time - this.lastFrameTime >= 30)) {
        this.processFrame(time);
      }
      this.scheduleNextFrame();
    }

    animationLoop(time) {
      this.animationFrameHandle = 0;
      if (!this.isRunning) return;
      if (!this.isPaused && (this.lastFrameTime === 0 || time - this.lastFrameTime >= 30)) {
        if (this.lastFrameTime && time - this.lastFrameTime > 220) this.resetTracking();
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
      this.convertToLuminance(this.currentPixels, this.currentPyramid[0].data);
      buildPyramid(this.currentPyramid);

      if (this.hasPreviousFrame && this.tracks.length) {
        this.trackFeatures();
        if (!this.tracks.length) {
          this.globalModel = identitySimilarity(this.globalModel);
          this.previousGlobalModel = identitySimilarity(this.previousGlobalModel);
        }
      } else {
        this.lastTrackingStats.retainedRatio = 1;
        this.lastTrackingStats.directRatio = 1;
        this.lastTrackingStats.dropped = 0;
        this.lastTrackingStats.retried = 0;
        this.lastTrackingStats.predicted = 0;
        this.lastTrackingStats.visibleRatio = 1;
        this.lastTrackingStats.visibleDropped = 0;
      }

      const target = this.targetPointCount();
      const needsRefill = this.tracks.length < target * 0.94;
      const severeCollapse = this.hasPreviousFrame && this.lastTrackingStats.retainedRatio < 0.65;
      if (
        !this.hasPreviousFrame ||
        this.tracks.length === 0 ||
        severeCollapse ||
        this.needsDetection ||
        (needsRefill && this.frameNumber - this.lastDetectionFrame >= 8)
      ) {
        this.seedFeatures(target);
        this.needsDetection = false;
        this.lastDetectionFrame = this.frameNumber;
      }

      if (
        this.performanceScale < 1 &&
        this.tracks.length > this.targetPointCount() &&
        this.frameNumber % 2 === 0
      ) {
        this.trimToTarget(0.01);
      }

      this.render();
      this.swapPyramids();
      this.hasPreviousFrame = true;
      this.frameNumber += 1;
      const workTime = performance.now() - frameStart;
      this.recordPerformance(workTime);
      this.updateStats(time, workTime);
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
      context.fillStyle = "#000";
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
      const sourceTracks = this.tracks;
      const sourceCount = sourceTracks.length;
      let sourceVisibleCount = 0;
      for (const point of sourceTracks) {
        if (point.age >= MIN_VISIBLE_AGE) sourceVisibleCount += 1;
      }
      this.provisionalTracks.length = 0;
      this.failedTracks.length = 0;
      this.flowValuesX.length = 0;
      this.flowValuesY.length = 0;

      for (const point of sourceTracks) {
        const globalPrediction = similarityDisplacement(this.globalModel, point.x, point.y, this.displacementScratch);
        const predictionX = point.age > 0
          ? point.predictDx * 0.78 + globalPrediction.x * 0.22
          : globalPrediction.x;
        const predictionY = point.age > 0
          ? point.predictDy * 0.78 + globalPrediction.y * 0.22
          : globalPrediction.y;

        this.trackPyramidal(
          this.previousPyramid,
          this.currentPyramid,
          point.x,
          point.y,
          predictionX,
          predictionY,
          this.flowScratch,
        );

        if (this.flowScratch.ok && this.basicFlowValidation(point, this.flowScratch)) {
          copyCandidate(point, this.flowScratch);
          this.provisionalTracks.push(point);
          this.flowValuesX.push(this.flowScratch.dx);
          this.flowValuesY.push(this.flowScratch.dy);
        } else {
          this.failedTracks.push(point);
        }
      }

      const provisionalCount = this.provisionalTracks.length;
      const estimatedModel = this.estimateDominantSimilarity(this.provisionalTracks);
      copySimilarity(this.previousGlobalModel, this.globalModel);
      copySimilarity(this.globalModel, estimatedModel);

      this.nextTracks.length = 0;
      const forwardBackwardStride = this.workTimeEma > 25 ? 10 : 6;

      for (const point of this.provisionalTracks) {
        const predicted = similarityDisplacement(this.globalModel, point.x, point.y, this.displacementScratch);
        const deviation = Math.hypot(point.candidateDx - predicted.x, point.candidateDy - predicted.y);
        const scheduledCheck = point.id % forwardBackwardStride === this.frameNumber % forwardBackwardStride;
        const questionable = scheduledCheck || deviation > 3.5 || point.candidateError > 24;

        if (questionable && !this.forwardBackwardValid(point, point.candidateDx, point.candidateDy)) {
          this.failedTracks.push(point);
          continue;
        }

        this.commitCandidate(point);
        this.nextTracks.push(point);
      }

      let retried = 0;
      let predicted = 0;
      const predictionIsReliable = provisionalCount >= sourceCount * 0.65;
      for (const point of this.failedTracks) {
        const prediction = similarityDisplacement(this.globalModel, point.x, point.y, this.displacementScratch);
        this.trackPyramidal(
          this.previousPyramid,
          this.currentPyramid,
          point.x,
          point.y,
          prediction.x,
          prediction.y,
          this.flowScratch,
        );

        if (
          this.flowScratch.ok &&
          this.basicFlowValidation(point, this.flowScratch) &&
          this.forwardBackwardValid(point, this.flowScratch.dx, this.flowScratch.dy)
        ) {
          copyCandidate(point, this.flowScratch);
          this.commitCandidate(point);
          this.nextTracks.push(point);
          retried += 1;
        } else if (predictionIsReliable && this.bridgeMissedFrame(point)) {
          this.nextTracks.push(point);
          predicted += 1;
        }
      }

      this.tracks = this.nextTracks;
      this.nextTracks = sourceTracks;
      this.nextTracks.length = 0;
      this.lastTrackingStats.retainedRatio = sourceCount ? this.tracks.length / sourceCount : 1;
      this.lastTrackingStats.directRatio = sourceCount ? provisionalCount / sourceCount : 1;
      this.lastTrackingStats.dropped = Math.max(0, sourceCount - this.tracks.length);
      this.lastTrackingStats.retried = retried;
      this.lastTrackingStats.predicted = predicted;
      let retainedVisibleCount = 0;
      for (const point of this.tracks) {
        if (point.age >= MIN_VISIBLE_AGE + 1) retainedVisibleCount += 1;
      }
      this.lastTrackingStats.visibleRatio = sourceVisibleCount ? retainedVisibleCount / sourceVisibleCount : 1;
      this.lastTrackingStats.visibleDropped = Math.max(0, sourceVisibleCount - retainedVisibleCount);
    }

    trackPyramidal(sourcePyramid, targetPyramid, baseX, baseY, initialDx, initialDy, output) {
      output.ok = false;
      output.outside = false;
      output.dx = 0;
      output.dy = 0;
      output.error = Infinity;
      output.eigen = 0;

      const topLevel = Math.min(sourcePyramid.length, targetPyramid.length) - 1;
      const topScale = 2 ** topLevel;
      let flowX = initialDx / topScale;
      let flowY = initialDy / topScale;
      let finestWasValid = false;
      let finestEigen = 0;

      for (let level = topLevel; level >= 0; level -= 1) {
        if (level !== topLevel) {
          flowX *= 2;
          flowY *= 2;
        }

        const sourceLevel = sourcePyramid[level];
        const targetLevel = targetPyramid[level];
        const scale = 2 ** level;
        const sourceX = toLevelCoordinate(baseX, scale);
        const sourceY = toLevelCoordinate(baseY, scale);
        const radius = level === 0 ? 4 : 3;
        const iterations = 3;
        const template = this.prepareTemplate(sourceLevel, sourceX, sourceY, radius);

        if (template.outside) {
          output.outside = true;
          return output;
        }

        const eigenFloor = level === 0 ? 2.5 : 0.75;
        if (template.eigen < eigenFloor || template.eigenRatio < 0.006) {
          if (level === 0) return output;
          continue;
        }

        if (level === 0) {
          finestWasValid = true;
          finestEigen = template.eigen;
        }

        for (let iteration = 0; iteration < iterations; iteration += 1) {
          const targetX = sourceX + flowX;
          const targetY = sourceY + flowY;
          if (!patchInside(targetLevel, targetX, targetY, radius + 1)) {
            output.outside = true;
            return output;
          }

          let residualMean = 0;
          for (let sample = 0; sample < template.count; sample += 1) {
            const value = bilinear(
              targetLevel.data,
              targetLevel.width,
              targetLevel.height,
              targetX + this.templateOffsetX[sample],
              targetY + this.templateOffsetY[sample],
            ) - this.templateValues[sample];
            this.residuals[sample] = value;
            residualMean += value;
          }
          residualMean /= template.count;

          let sumGradientTemporalX = 0;
          let sumGradientTemporalY = 0;
          for (let sample = 0; sample < template.count; sample += 1) {
            const residual = this.residuals[sample] - residualMean;
            sumGradientTemporalX += this.templateGradientX[sample] * residual;
            sumGradientTemporalY += this.templateGradientY[sample] * residual;
          }

          const determinant = template.sumXX * template.sumYY - template.sumXY * template.sumXY;
          if (determinant <= 1e-6) return output;
          const stepX = (-template.sumYY * sumGradientTemporalX + template.sumXY * sumGradientTemporalY) / determinant;
          const stepY = (template.sumXY * sumGradientTemporalX - template.sumXX * sumGradientTemporalY) / determinant;

          if (!Number.isFinite(stepX + stepY) || stepX * stepX + stepY * stepY > 12.25) return output;
          flowX += stepX;
          flowY += stepY;
          if (stepX * stepX + stepY * stepY < 0.0025) break;
        }
      }

      if (!finestWasValid) return output;
      const finalError = this.patchResidualRms(
        sourcePyramid[0],
        targetPyramid[0],
        baseX,
        baseY,
        flowX,
        flowY,
        4,
      );

      if (!Number.isFinite(finalError) || finalError > 32) return output;
      if (flowX * flowX + flowY * flowY > 3600) return output;

      output.ok = true;
      output.dx = flowX;
      output.dy = flowY;
      output.error = finalError;
      output.eigen = finestEigen;
      return output;
    }

    prepareTemplate(level, centerX, centerY, radius) {
      const result = this.templateScratch;
      if (!patchInside(level, centerX, centerY, radius + 1)) {
        result.outside = true;
        result.count = 0;
        result.eigen = 0;
        result.eigenRatio = 0;
        result.sumXX = 0;
        result.sumXY = 0;
        result.sumYY = 0;
        return result;
      }

      let count = 0;
      let sumXX = 0;
      let sumXY = 0;
      let sumYY = 0;

      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = centerX + offsetX;
          const sampleY = centerY + offsetY;
          const value = bilinear(level.data, level.width, level.height, sampleX, sampleY);
          const gradientX = (
            bilinear(level.data, level.width, level.height, sampleX + 1, sampleY) -
            bilinear(level.data, level.width, level.height, sampleX - 1, sampleY)
          ) * 0.5;
          const gradientY = (
            bilinear(level.data, level.width, level.height, sampleX, sampleY + 1) -
            bilinear(level.data, level.width, level.height, sampleX, sampleY - 1)
          ) * 0.5;

          this.templateValues[count] = value;
          this.templateGradientX[count] = gradientX;
          this.templateGradientY[count] = gradientY;
          this.templateOffsetX[count] = offsetX;
          this.templateOffsetY[count] = offsetY;
          sumXX += gradientX * gradientX;
          sumXY += gradientX * gradientY;
          sumYY += gradientY * gradientY;
          count += 1;
        }
      }

      const trace = sumXX + sumYY;
      const discriminant = Math.sqrt(Math.max(0, (sumXX - sumYY) ** 2 + 4 * sumXY * sumXY));
      const eigenMin = (trace - discriminant) * 0.5 / count;
      const eigenMax = (trace + discriminant) * 0.5 / count;
      result.outside = false;
      result.count = count;
      result.eigen = eigenMin;
      result.eigenRatio = eigenMin / Math.max(1e-6, eigenMax);
      result.sumXX = sumXX;
      result.sumXY = sumXY;
      result.sumYY = sumYY;
      return result;
    }

    patchResidualRms(sourceLevel, targetLevel, x, y, dx, dy, radius) {
      if (
        !patchInside(sourceLevel, x, y, radius + 1) ||
        !patchInside(targetLevel, x + dx, y + dy, radius + 1)
      ) return Infinity;

      let count = 0;
      let residualMean = 0;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sourceValue = bilinear(sourceLevel.data, sourceLevel.width, sourceLevel.height, x + offsetX, y + offsetY);
          const targetValue = bilinear(
            targetLevel.data,
            targetLevel.width,
            targetLevel.height,
            x + dx + offsetX,
            y + dy + offsetY,
          );
          const residual = targetValue - sourceValue;
          this.residuals[count] = residual;
          residualMean += residual;
          count += 1;
        }
      }
      residualMean /= count;

      let squaredError = 0;
      for (let index = 0; index < count; index += 1) {
        const centered = this.residuals[index] - residualMean;
        squaredError += centered * centered;
      }
      return Math.sqrt(squaredError / count);
    }

    basicFlowValidation(point, result) {
      const nextX = point.x + result.dx;
      const nextY = point.y + result.dy;
      const border = 6;
      return (
        result.ok &&
        result.error <= 32 &&
        nextX >= border &&
        nextY >= border &&
        nextX < this.analysisWidth - border &&
        nextY < this.analysisHeight - border
      );
    }

    forwardBackwardValid(point, dx, dy) {
      const nextX = point.x + dx;
      const nextY = point.y + dy;
      this.trackPyramidal(
        this.currentPyramid,
        this.previousPyramid,
        nextX,
        nextY,
        -dx,
        -dy,
        this.backwardScratch,
      );
      if (!this.backwardScratch.ok) return false;
      const closureX = nextX + this.backwardScratch.dx - point.x;
      const closureY = nextY + this.backwardScratch.dy - point.y;
      return closureX * closureX + closureY * closureY <= 2.25;
    }

    estimateDominantSimilarity(points) {
      if (points.length < 8) return this.estimateMedianTranslation(points);

      let bestModel = null;
      let bestInliers = 0;
      const hypotheses = Math.min(32, points.length);

      for (let hypothesis = 0; hypothesis < hypotheses; hypothesis += 1) {
        const firstIndex = (hypothesis * 37) % points.length;
        let secondIndex = (firstIndex + Math.floor(points.length / 2) + hypothesis * 17 + 1) % points.length;
        if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % points.length;
        const first = points[firstIndex];
        const second = points[secondIndex];
        const model = similarityFromPair(first, second);
        if (!model) continue;

        const scale = Math.hypot(model.a, model.b);
        if (scale < 0.96 || scale > 1.04 || Math.hypot(model.tx, model.ty) > 70) continue;
        const inliers = countSimilarityInliers(model, points, 2.1);
        if (inliers > bestInliers) {
          bestInliers = inliers;
          bestModel = model;
        }
      }

      if (!bestModel || bestInliers < Math.max(8, points.length * 0.22)) {
        return this.estimateMedianTranslation(points);
      }
      return refineSimilarity(bestModel, points, 2.1) || bestModel;
    }

    estimateMedianTranslation(points) {
      if (!points.length) return identitySimilarity();
      this.flowValuesX.length = 0;
      this.flowValuesY.length = 0;
      for (const point of points) {
        this.flowValuesX.push(point.candidateDx);
        this.flowValuesY.push(point.candidateDy);
      }
      return {
        a: 1,
        b: 0,
        tx: median(this.flowValuesX),
        ty: median(this.flowValuesY),
      };
    }

    commitCandidate(point) {
      point.x += point.candidateDx;
      point.y += point.candidateDy;
      point.vx = point.candidateDx;
      point.vy = point.candidateDy;
      point.predictDx = point.predictDx * 0.28 + point.candidateDx * 0.72;
      point.predictDy = point.predictDy * 0.28 + point.candidateDy * 0.72;
      point.age += 1;
      point.misses = 0;
      point.quality = point.quality * 0.94 + clamp(point.candidateEigen / 48, 0, 1) * 0.06;
      this.samplePointColor(point);
    }

    bridgeMissedFrame(point) {
      if (point.age < 8 || (point.misses || 0) >= 1) return false;
      const globalPrediction = similarityDisplacement(this.globalModel, point.x, point.y, this.displacementScratch);
      const dx = point.predictDx * 0.78 + globalPrediction.x * 0.22;
      const dy = point.predictDy * 0.78 + globalPrediction.y * 0.22;
      if (!Number.isFinite(dx + dy) || dx * dx + dy * dy > 144) return false;

      const nextX = point.x + dx;
      const nextY = point.y + dy;
      const border = 6;
      if (nextX < border || nextY < border || nextX >= this.analysisWidth - border || nextY >= this.analysisHeight - border) {
        return false;
      }

      point.x = nextX;
      point.y = nextY;
      point.vx = dx;
      point.vy = dy;
      point.predictDx = point.predictDx * 0.35 + dx * 0.65;
      point.predictDy = point.predictDy * 0.35 + dy * 0.65;
      point.age += 1;
      point.misses = 1;
      return true;
    }

    seedFeatures(targetCount) {
      const width = this.analysisWidth;
      const height = this.analysisHeight;
      const size = width * height;
      const current = this.currentPyramid[0].data;
      const gradientX = this.gradientX;
      const gradientY = this.gradientY;
      gradientX.fill(0);
      gradientY.fill(0);

      for (let y = 1; y < height - 1; y += 1) {
        let index = y * width + 1;
        for (let x = 1; x < width - 1; x += 1, index += 1) {
          gradientX[index] = (current[index + 1] - current[index - 1]) * 0.5;
          gradientY[index] = (current[index + width] - current[index - width]) * 0.5;
        }
      }

      const cellSize = clamp(Math.round(Math.sqrt(size / Math.max(1, targetCount)) * 0.78), 4, 10);
      const cellsX = Math.ceil(width / cellSize);
      const cellsY = Math.ceil(height / cellSize);
      const cellCount = cellsX * cellsY;
      const bestScore = new Float32Array(cellCount);
      const bestX = new Int16Array(cellCount);
      const bestY = new Int16Array(cellCount);
      let frameMaximum = 0;
      const tensorRadius = 2;

      for (let y = 4; y < height - 4; y += 2) {
        for (let x = 4; x < width - 4; x += 2) {
          let sumXX = 0;
          let sumXY = 0;
          let sumYY = 0;

          for (let windowY = -tensorRadius; windowY <= tensorRadius; windowY += 1) {
            let index = (y + windowY) * width + x - tensorRadius;
            for (let windowX = -tensorRadius; windowX <= tensorRadius; windowX += 1, index += 1) {
              const gx = gradientX[index];
              const gy = gradientY[index];
              sumXX += gx * gx;
              sumXY += gx * gy;
              sumYY += gy * gy;
            }
          }

          const trace = sumXX + sumYY;
          const difference = sumXX - sumYY;
          const score = Math.max(0, (trace - Math.sqrt(difference * difference + 4 * sumXY * sumXY)) * 0.5);
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
      const threshold = Math.max(20, frameMaximum * 0.002);
      const candidates = [];
      for (let index = 0; index < cellCount; index += 1) {
        if (bestScore[index] >= threshold) {
          candidates.push({ x: bestX[index], y: bestY[index], score: bestScore[index] });
        }
      }
      candidates.sort((first, second) => second.score - first.score);

      const minimumDistance = 4;
      const bucketSize = minimumDistance;
      const bucketColumns = Math.ceil(width / bucketSize);
      const bucketRows = Math.ceil(height / bucketSize);
      const buckets = new Int32Array(bucketColumns * bucketRows);
      const bucketLinks = new Int32Array(Math.max(1, targetCount, this.tracks.length));
      buckets.fill(-1);
      bucketLinks.fill(-1);
      for (let index = 0; index < this.tracks.length; index += 1) {
        placeInBucket(buckets, bucketLinks, bucketColumns, bucketRows, bucketSize, this.tracks[index], index);
      }

      for (const candidate of candidates) {
        if (this.tracks.length >= targetCount) break;
        if (hasNearbyTrack(candidate, this.tracks, buckets, bucketLinks, bucketColumns, bucketRows, bucketSize, minimumDistance)) continue;
        const trackingTemplate = this.prepareTemplate(this.currentPyramid[0], candidate.x, candidate.y, 4);
        if (trackingTemplate.outside || trackingTemplate.eigen < 2.5 || trackingTemplate.eigenRatio < 0.006) continue;

        const prediction = similarityDisplacement(this.globalModel, candidate.x, candidate.y, this.displacementScratch);
        const point = {
          id: this.nextTrackId,
          x: candidate.x,
          y: candidate.y,
          vx: 0,
          vy: 0,
          predictDx: prediction.x,
          predictDy: prediction.y,
          r: 150,
          g: 170,
          b: 170,
          age: 0,
          misses: 0,
          quality: Math.sqrt(candidate.score / frameMaximum),
          candidateDx: 0,
          candidateDy: 0,
          candidateError: 0,
          candidateEigen: 0,
        };
        this.nextTrackId += 1;
        this.samplePointColor(point, true);
        this.tracks.push(point);
        placeInBucket(buckets, bucketLinks, bucketColumns, bucketRows, bucketSize, point, this.tracks.length - 1);
      }

      this.trimToTarget();
    }

    samplePointColor(point, immediate = false) {
      const width = this.analysisWidth;
      const height = this.analysisHeight;
      const centerX = clamp(Math.round(point.x), 1, width - 2);
      const centerY = clamp(Math.round(point.y), 1, height - 2);
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const index = ((centerY + offsetY) * width + centerX + offsetX) * 4;
          red += this.currentPixels[index];
          green += this.currentPixels[index + 1];
          blue += this.currentPixels[index + 2];
        }
      }

      red /= 9;
      green /= 9;
      blue /= 9;
      let luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      red = luminance + (red - luminance) * 1.1;
      green = luminance + (green - luminance) * 1.1;
      blue = luminance + (blue - luminance) * 1.1;
      if (luminance < 58) {
        const boost = 58 / Math.max(18, luminance);
        red *= boost;
        green *= boost;
        blue *= boost;
        luminance *= boost;
      }

      const amount = immediate ? 1 : 0.08;
      point.r += (clamp(red, 0, 255) - point.r) * amount;
      point.g += (clamp(green, 0, 255) - point.g) * amount;
      point.b += (clamp(blue, 0, 255) - point.b) * amount;
    }

    render() {
      const context = this.frameContext;
      const outputWidth = this.outputCanvas.width;
      const outputHeight = this.outputCanvas.height;
      if (!outputWidth || !outputHeight) return;

      context.globalCompositeOperation = "source-over";
      context.fillStyle = "#000";
      context.fillRect(0, 0, outputWidth, outputHeight);

      const scaleX = outputWidth / this.analysisWidth;
      const scaleY = outputHeight / this.analysisHeight;
      const baseRadius = this.settings.dotSize * this.outputDpr;
      let visiblePointCount = 0;

      for (const point of this.tracks) {
        if (point.age < MIN_VISIBLE_AGE) continue;
        visiblePointCount += 1;
        const color = this.pointColor(point, this.colorScratch);
        const radius = baseRadius * (0.94 + point.quality * 0.1);
        context.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`;
        context.beginPath();
        context.arc(point.x * scaleX, point.y * scaleY, radius, 0, TAU);
        context.fill();
      }

      const continuityFloor = Math.max(24, Math.round(this.lastPresentedPointCount * 0.8));
      if (this.hasPresentedFrame && visiblePointCount < continuityFloor && this.presentationHoldFrames < 3) {
        this.presentationHoldFrames += 1;
        return;
      }

      const output = this.outputContext;
      output.setTransform(1, 0, 0, 1, 0, 0);
      output.globalCompositeOperation = "copy";
      output.drawImage(this.frameCanvas, 0, 0);
      output.globalCompositeOperation = "source-over";
      this.hasPresentedFrame = true;
      this.presentationHoldFrames = 0;
      this.lastPresentedPointCount = visiblePointCount;
    }

    pointColor(point, target) {
      let red = point.r;
      let green = point.g;
      let blue = point.b;

      if (this.settings.palette === "mono") {
        const light = clamp(0.3 * red + 0.58 * green + 0.12 * blue, 66, 246);
        red = light * 0.93;
        green = light * 0.98;
        blue = Math.min(255, light * 1.04 + 4);
      } else if (this.settings.palette === "prism") {
        const phase = point.id * 2.399963;
        const prismRed = 145 + 90 * Math.sin(phase);
        const prismGreen = 145 + 90 * Math.sin(phase + 2.094);
        const prismBlue = 145 + 90 * Math.sin(phase + 4.189);
        red = red * 0.72 + prismRed * 0.28;
        green = green * 0.72 + prismGreen * 0.28;
        blue = blue * 0.72 + prismBlue * 0.28;
      }

      const maximum = Math.max(red, green, blue);
      if (maximum < 66) {
        const boost = 66 / Math.max(1, maximum);
        red *= boost;
        green *= boost;
        blue *= boost;
      }
      target[0] = Math.round(clamp(red, 0, 255));
      target[1] = Math.round(clamp(green, 0, 255));
      target[2] = Math.round(clamp(blue, 0, 255));
      return target;
    }

    targetPointCount() {
      const density = this.settings.density / 100;
      const referenceArea = 208 * 448;
      const areaScale = Math.sqrt((this.analysisWidth * this.analysisHeight) / referenceArea);
      return Math.round(clamp((450 + density * 1600) * areaScale * this.performanceScale, 500, 2200));
    }

    trimToTarget(maxRemovalFraction = 1) {
      const target = this.targetPointCount();
      if (this.tracks.length <= target) return;
      this.tracks.sort((first, second) => {
        const visibilityDifference = Number(second.age >= MIN_VISIBLE_AGE) - Number(first.age >= MIN_VISIBLE_AGE);
        return visibilityDifference || second.quality - first.quality;
      });
      const maximumRemoval = Math.max(1, Math.ceil(this.tracks.length * clamp(maxRemovalFraction, 0, 1)));
      this.tracks.length = Math.max(target, this.tracks.length - maximumRemoval);
    }

    swapPyramids() {
      const previous = this.previousPyramid;
      this.previousPyramid = this.currentPyramid;
      this.currentPyramid = previous;
    }

    recordPerformance(workTime) {
      this.workTimeEma = this.workTimeEma ? this.workTimeEma * 0.9 + workTime * 0.1 : workTime;
      if (this.workTimeEma > 30) {
        this.overBudgetFrames += 1;
        this.underBudgetFrames = 0;
      } else if (this.workTimeEma < 23) {
        this.underBudgetFrames += 1;
        this.overBudgetFrames = 0;
      } else {
        this.overBudgetFrames = 0;
        this.underBudgetFrames = 0;
      }

      if (this.overBudgetFrames >= 12 && this.performanceScale > 0.58) {
        this.performanceScale = Math.max(0.58, this.performanceScale * 0.88);
        this.overBudgetFrames = 0;
      } else if (this.underBudgetFrames >= 120 && this.performanceScale < 1) {
        this.performanceScale = Math.min(1, this.performanceScale + 0.06);
        this.underBudgetFrames = 0;
        this.needsDetection = true;
      }
    }

    updateStats(time, workTime) {
      this.statsFrameCount += 1;
      if (!this.lastStatsTime) this.lastStatsTime = time;
      const elapsed = time - this.lastStatsTime;
      if (elapsed < 500) return;

      this.fps = (this.statsFrameCount * 1000) / Math.max(1, elapsed);
      this.statsFrameCount = 0;
      this.lastStatsTime = time;
      let stableTracks = 0;
      let totalAge = 0;
      let visibleTracks = 0;
      for (const point of this.tracks) {
        if (point.age < MIN_VISIBLE_AGE) continue;
        visibleTracks += 1;
        if (point.age >= 60) stableTracks += 1;
        totalAge += point.age;
      }
      this.onStats({
        pointCount: visibleTracks,
        fps: Math.round(this.fps),
        workTime: Math.round(workTime * 10) / 10,
        workTimeEma: Math.round(this.workTimeEma * 10) / 10,
        retainedRatio: this.lastTrackingStats.visibleRatio,
        rawRetainedRatio: this.lastTrackingStats.retainedRatio,
        directRatio: this.lastTrackingStats.directRatio,
        dropped: this.lastTrackingStats.visibleDropped,
        rawDropped: this.lastTrackingStats.dropped,
        retried: this.lastTrackingStats.retried,
        predicted: this.lastTrackingStats.predicted,
        performanceScale: this.performanceScale,
        stableRatio: visibleTracks ? stableTracks / visibleTracks : 1,
        averageAge: visibleTracks ? totalAge / visibleTracks : 0,
        globalMotion: {
          a: this.globalModel.a,
          b: this.globalModel.b,
          tx: this.globalModel.tx,
          ty: this.globalModel.ty,
        },
      });
    }

    clearOutput() {
      if (!this.outputContext || !this.outputCanvas.width || !this.outputCanvas.height) return;
      for (const context of [this.frameContext, this.outputContext]) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalCompositeOperation = "source-over";
        context.fillStyle = "#000";
        context.fillRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
      }
      this.hasPresentedFrame = false;
      this.presentationHoldFrames = 0;
      this.lastPresentedPointCount = 0;
    }
  }

  function allocatePyramid(width, height, levels) {
    const pyramid = [];
    let levelWidth = width;
    let levelHeight = height;
    for (let level = 0; level < levels; level += 1) {
      pyramid.push({
        width: levelWidth,
        height: levelHeight,
        data: new Uint8Array(levelWidth * levelHeight),
      });
      levelWidth = Math.max(1, Math.floor(levelWidth / 2));
      levelHeight = Math.max(1, Math.floor(levelHeight / 2));
    }
    return pyramid;
  }

  function buildPyramid(pyramid) {
    for (let level = 1; level < pyramid.length; level += 1) {
      const source = pyramid[level - 1];
      const target = pyramid[level];
      for (let y = 0; y < target.height; y += 1) {
        const sourceY = y * 2;
        for (let x = 0; x < target.width; x += 1) {
          const sourceX = x * 2;
          const topLeft = sourceY * source.width + sourceX;
          target.data[y * target.width + x] = (
            source.data[topLeft] +
            source.data[topLeft + 1] +
            source.data[topLeft + source.width] +
            source.data[topLeft + source.width + 1] +
            2
          ) >> 2;
        }
      }
    }
  }

  function createFlowResult() {
    return { ok: false, outside: false, dx: 0, dy: 0, error: Infinity, eigen: 0 };
  }

  function createTemplateResult() {
    return { outside: true, count: 0, eigen: 0, eigenRatio: 0, sumXX: 0, sumXY: 0, sumYY: 0 };
  }

  function copyCandidate(point, result) {
    point.candidateDx = result.dx;
    point.candidateDy = result.dy;
    point.candidateError = result.error;
    point.candidateEigen = result.eigen;
  }

  function toLevelCoordinate(value, scale) {
    return (value + 0.5) / scale - 0.5;
  }

  function patchInside(level, x, y, radius) {
    return x >= radius && y >= radius && x < level.width - radius - 1 && y < level.height - radius - 1;
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

  function identitySimilarity(target = {}) {
    target.a = 1;
    target.b = 0;
    target.tx = 0;
    target.ty = 0;
    return target;
  }

  function copySimilarity(target, source) {
    target.a = source.a;
    target.b = source.b;
    target.tx = source.tx;
    target.ty = source.ty;
    return target;
  }

  function similarityDisplacement(model, x, y, target) {
    target.x = model.a * x - model.b * y + model.tx - x;
    target.y = model.b * x + model.a * y + model.ty - y;
    return target;
  }

  function similarityFromPair(first, second) {
    const firstOldX = first.x;
    const firstOldY = first.y;
    const secondOldX = second.x;
    const secondOldY = second.y;
    const firstNewX = first.x + first.candidateDx;
    const firstNewY = first.y + first.candidateDy;
    const secondNewX = second.x + second.candidateDx;
    const secondNewY = second.y + second.candidateDy;
    const oldDeltaX = secondOldX - firstOldX;
    const oldDeltaY = secondOldY - firstOldY;
    const newDeltaX = secondNewX - firstNewX;
    const newDeltaY = secondNewY - firstNewY;
    const denominator = oldDeltaX * oldDeltaX + oldDeltaY * oldDeltaY;
    if (denominator < 400) return null;

    const a = (newDeltaX * oldDeltaX + newDeltaY * oldDeltaY) / denominator;
    const b = (newDeltaY * oldDeltaX - newDeltaX * oldDeltaY) / denominator;
    return {
      a,
      b,
      tx: firstNewX - a * firstOldX + b * firstOldY,
      ty: firstNewY - b * firstOldX - a * firstOldY,
    };
  }

  function countSimilarityInliers(model, points, threshold) {
    const thresholdSquared = threshold * threshold;
    let inliers = 0;
    for (const point of points) {
      const predictedX = model.a * point.x - model.b * point.y + model.tx;
      const predictedY = model.b * point.x + model.a * point.y + model.ty;
      const actualX = point.x + point.candidateDx;
      const actualY = point.y + point.candidateDy;
      const errorX = predictedX - actualX;
      const errorY = predictedY - actualY;
      if (errorX * errorX + errorY * errorY <= thresholdSquared) inliers += 1;
    }
    return inliers;
  }

  function refineSimilarity(model, points, threshold) {
    const thresholdSquared = threshold * threshold;
    let count = 0;
    let oldCenterX = 0;
    let oldCenterY = 0;
    let newCenterX = 0;
    let newCenterY = 0;

    for (const point of points) {
      const predictedX = model.a * point.x - model.b * point.y + model.tx;
      const predictedY = model.b * point.x + model.a * point.y + model.ty;
      const actualX = point.x + point.candidateDx;
      const actualY = point.y + point.candidateDy;
      const errorX = predictedX - actualX;
      const errorY = predictedY - actualY;
      if (errorX * errorX + errorY * errorY > thresholdSquared) continue;
      oldCenterX += point.x;
      oldCenterY += point.y;
      newCenterX += actualX;
      newCenterY += actualY;
      count += 1;
    }

    if (count < 4) return null;
    oldCenterX /= count;
    oldCenterY /= count;
    newCenterX /= count;
    newCenterY /= count;
    let denominator = 0;
    let numeratorA = 0;
    let numeratorB = 0;

    for (const point of points) {
      const predictedX = model.a * point.x - model.b * point.y + model.tx;
      const predictedY = model.b * point.x + model.a * point.y + model.ty;
      const actualX = point.x + point.candidateDx;
      const actualY = point.y + point.candidateDy;
      const errorX = predictedX - actualX;
      const errorY = predictedY - actualY;
      if (errorX * errorX + errorY * errorY > thresholdSquared) continue;
      const oldX = point.x - oldCenterX;
      const oldY = point.y - oldCenterY;
      const newX = actualX - newCenterX;
      const newY = actualY - newCenterY;
      denominator += oldX * oldX + oldY * oldY;
      numeratorA += oldX * newX + oldY * newY;
      numeratorB += oldX * newY - oldY * newX;
    }

    if (denominator < 1e-6) return null;
    const a = numeratorA / denominator;
    const b = numeratorB / denominator;
    const scale = Math.hypot(a, b);
    if (scale < 0.96 || scale > 1.04) return null;
    return {
      a,
      b,
      tx: newCenterX - a * oldCenterX + b * oldCenterY,
      ty: newCenterY - b * oldCenterX - a * oldCenterY,
    };
  }

  function median(values) {
    if (!values.length) return 0;
    values.sort((first, second) => first - second);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) * 0.5;
  }

  function placeInBucket(buckets, links, columns, rows, bucketSize, point, pointIndex) {
    const column = Math.floor(point.x / bucketSize);
    const row = Math.floor(point.y / bucketSize);
    if (column >= 0 && column < columns && row >= 0 && row < rows) {
      const bucketIndex = row * columns + column;
      links[pointIndex] = buckets[bucketIndex];
      buckets[bucketIndex] = pointIndex;
    }
  }

  function hasNearbyTrack(candidate, tracks, buckets, links, columns, rows, bucketSize, minimumDistance) {
    const centerColumn = Math.floor(candidate.x / bucketSize);
    const centerRow = Math.floor(candidate.y / bucketSize);
    const minimumDistanceSquared = minimumDistance * minimumDistance;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      const row = centerRow + rowOffset;
      if (row < 0 || row >= rows) continue;
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const column = centerColumn + columnOffset;
        if (column < 0 || column >= columns) continue;
        let pointIndex = buckets[row * columns + column];
        while (pointIndex >= 0) {
          const point = tracks[pointIndex];
          const differenceX = point.x - candidate.x;
          const differenceY = point.y - candidate.y;
          if (differenceX * differenceX + differenceY * differenceY < minimumDistanceSquared) return true;
          pointIndex = links[pointIndex];
        }
      }
    }
    return false;
  }

  function drawWatermark(context, width, height) {
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
    context.fillStyle = "rgba(0, 0, 0, .62)";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.2)";
    context.lineWidth = Math.max(1, width / 1100);
    context.stroke();
    context.fillStyle = "#d9ff69";
    context.beginPath();
    context.arc(x + labelSize * 1.25, y + pillHeight / 2, dotRadius, 0, TAU);
    context.fill();
    context.fillStyle = "rgba(255,255,255,.78)";
    context.textBaseline = "middle";
    context.fillText(label, x + labelSize * 2.1, y + pillHeight / 2 + 1);
    context.restore();
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
