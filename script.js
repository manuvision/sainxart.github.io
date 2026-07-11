(() => {
    "use strict";

    const root = document.documentElement;
    const body = document.body;
    const header = document.getElementById("siteHeader");
    const progress = document.getElementById("scrollProgress");
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");
    const navContact = header.querySelector(".nav-contact");
    const heroAtmosphere = document.getElementById("heroAtmosphere");
    const contactSection = document.querySelector(".contact");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastScrollTop = window.scrollY;

    const loadDeferredImages = () => {
        const load = () => {
            document.querySelectorAll("img[data-deferred-src]").forEach((image) => {
                if (!image.currentSrc && !image.getAttribute("src")) {
                    image.src = image.dataset.deferredSrc;
                }
            });
        };

        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(load, { timeout: 1400 });
        } else {
            window.setTimeout(load, 250);
        }
    };

    if (document.readyState === "complete") {
        loadDeferredImages();
    } else {
        window.addEventListener("load", loadDeferredImages, { once: true });
    }

    const updateScrollUI = () => {
        const scrollTop = window.scrollY;
        const scrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        progress.style.transform = `scaleX(${Math.min(scrollTop / scrollable, 1)})`;
        header.classList.toggle("is-scrolled", scrollTop > 40);
        const scrollingDown = scrollTop > lastScrollTop + 2;
        const scrollingUp = scrollTop < lastScrollTop - 2;
        if (!body.classList.contains("nav-open")) {
            if (scrollingDown && scrollTop > 140) header.classList.add("is-compact");
            if (scrollingUp || scrollTop <= 70) header.classList.remove("is-compact");
        }
        lastScrollTop = Math.max(scrollTop, 0);
        if (heroAtmosphere) {
            const maxParallax = Math.min(window.innerHeight * 0.14, 120);
            const parallaxY = Math.min(Math.max(scrollTop, 0) * 0.28, maxParallax);
            heroAtmosphere.style.setProperty("--hero-bg-parallax-y", `${parallaxY.toFixed(2)}px`);
        }
        if (contactSection) {
            const contactRect = contactSection.getBoundingClientRect();
            const travelRange = Math.max(window.innerHeight + contactRect.height, 1);
            const progressThroughViewport = (window.innerHeight - contactRect.top) / travelRange;
            const centeredProgress = Math.max(-0.5, Math.min(0.5, progressThroughViewport - 0.5));
            const contactParallaxY = centeredProgress * Math.min(window.innerHeight * 0.72, 400);
            contactSection.style.setProperty("--contact-parallax-y", `${contactParallaxY.toFixed(2)}px`);
        }
    };

    updateScrollUI();
    window.addEventListener("scroll", updateScrollUI, { passive: true });
    window.addEventListener("resize", updateScrollUI, { passive: true });

    const closeMenu = ({ restoreFocus = false } = {}) => {
        navLinks.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        body.classList.remove("nav-open");
        if (restoreFocus) menuToggle.focus();
    };

    menuToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = menuToggle.getAttribute("aria-expanded") !== "true";
        menuToggle.setAttribute("aria-expanded", String(willOpen));
        navLinks.classList.toggle("is-open", willOpen);
        body.classList.toggle("nav-open", willOpen);
        header.classList.toggle("is-compact", false);
        if (willOpen && event.detail === 0) navLinks.querySelector("a")?.focus();
    });

    navLinks.addEventListener("click", (event) => {
        if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navLinks.classList.contains("is-open")) {
            closeMenu({ restoreFocus: true });
        }
    });

    document.querySelectorAll(".testimonial-card").forEach((card) => {
        const quote = card.querySelector("blockquote");
        const caption = card.querySelector("figcaption");
        if (!quote || !caption) return;

        const toggle = document.createElement("button");
        toggle.className = "testimonial-toggle";
        toggle.type = "button";
        toggle.textContent = "Show more";
        toggle.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        card.insertBefore(toggle, caption);

        window.requestAnimationFrame(() => {
            toggle.hidden = quote.scrollHeight <= quote.clientHeight + 2;
        });

        toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            const expanded = card.classList.toggle("is-expanded");
            toggle.textContent = expanded ? "Show less" : "Show more";
            toggle.setAttribute("aria-expanded", String(expanded));
        });
    });

    const pressToggle = document.getElementById("pressToggle");
    const pressGrid = document.getElementById("pressGrid");
    pressToggle?.addEventListener("click", () => {
        const expanded = pressGrid.classList.toggle("is-expanded");
        pressToggle.textContent = expanded ? "Show less" : "Show more";
        pressToggle.setAttribute("aria-expanded", String(expanded));
    });

    const sectionLinks = [...navLinks.querySelectorAll('a[href^="#"]')];
    const sectionMap = new Map(sectionLinks.map((link) => [link.getAttribute("href").slice(1), link]));
    sectionMap.set("contact", navContact);
    sectionMap.set("top", null);
    const currentLinks = [...sectionLinks, navContact].filter(Boolean);
    const observedSections = [...sectionMap.keys()]
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    if ("IntersectionObserver" in window) {
        const updateCurrentSection = () => {
            const marker = window.innerHeight * 0.36;
            const currentSection = observedSections.find((section) => {
                const rect = section.getBoundingClientRect();
                return rect.top <= marker && rect.bottom > marker;
            });
            if (!currentSection) return;
            currentLinks.forEach((link) => link.removeAttribute("aria-current"));
            sectionMap.get(currentSection.id)?.setAttribute("aria-current", "location");
        };
        const sectionObserver = new IntersectionObserver(updateCurrentSection, { rootMargin: "-28% 0px -58%", threshold: [0.05, 0.25, 0.5] });

        observedSections.forEach((section) => sectionObserver.observe(section));
        updateCurrentSection();
    }

    const metrics = [...document.querySelectorAll(".metric dt")];

    const animateMetric = (metric, delay) => {
        const finalLabel = metric.dataset.finalLabel;
        const match = finalLabel.match(/^([\d.]+)(.*)$/);
        if (!match) return;

        const target = Number(match[1]);
        const suffix = match[2];
        const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
        const duration = 2000;

        window.setTimeout(() => {
            const start = performance.now();

            const tick = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const value = target * eased;
                metric.textContent = `${decimals ? value.toFixed(decimals) : Math.round(value)}${suffix}`;

                if (progress < 1) {
                    window.requestAnimationFrame(tick);
                } else {
                    metric.textContent = finalLabel;
                }
            };

            window.requestAnimationFrame(tick);
        }, delay);
    };

    if (metrics.length && "IntersectionObserver" in window && !reduceMotion.matches) {
        metrics.forEach((metric) => {
            metric.dataset.finalLabel = metric.textContent.trim();
            metric.setAttribute("aria-label", metric.dataset.finalLabel);
            metric.textContent = `0${metric.dataset.finalLabel.replace(/^[\d.]+/, "")}`;
        });

        const metricObserver = new IntersectionObserver((entries, observer) => {
            const gridEntry = entries.find((entry) => entry.isIntersecting);
            if (!gridEntry) return;

            metrics.forEach((metric, index) => animateMetric(metric, index * 100));
            observer.disconnect();
        }, { threshold: 0.18 });

        metricObserver.observe(document.querySelector(".kpi-grid"));
    }

    // A stable low-resolution portrait field is revealed by the face detector.
    const heroVisual = document.getElementById("heroVisual");
    const heroSource = document.getElementById("heroSource");
    const heroAlternateSource = document.getElementById("heroAlternateSource");
    const ditherCanvas = document.getElementById("ditherCanvas");
    const portraitCycleCanvas = document.getElementById("portraitCycleCanvas");
    const glitchCanvas = document.getElementById("glitchCanvas");
    const clarityLens = document.getElementById("clarityLens");
    const spyCoordinates = document.getElementById("spyCoordinates");
    const currentRole = document.querySelector(".current-role");
    const heroGetInTouch = document.querySelector(".hero-actions .button--sun");
    const readBioButton = document.querySelector(".current-role__bio");
    const heroCopy = document.querySelector(".hero-copy");
    const heroSection = document.querySelector(".hero");

    const alignHeroActions = () => {
        if (!heroGetInTouch || !readBioButton || !heroCopy || !heroSection) return;
        if (window.innerWidth <= 820) {
            heroCopy.style.removeProperty("--hero-copy-align-y");
            const heroRect = heroSection.getBoundingClientRect();
            const visualRect = heroVisual.getBoundingClientRect();
            const atmosphereTop = Math.max(0, visualRect.bottom - heroRect.top);
            heroSection.style.setProperty("--hero-bg-mobile-top", `${atmosphereTop.toFixed(1)}px`);
            return;
        }

        heroSection.style.removeProperty("--hero-bg-mobile-top");
        heroCopy.style.setProperty("--hero-copy-align-y", "0px");
        const contactRect = heroGetInTouch.getBoundingClientRect();
        const bioRect = readBioButton.getBoundingClientRect();
        const contactCenter = contactRect.top + (contactRect.height / 2);
        const bioCenter = bioRect.top + (bioRect.height / 2);
        const offset = Math.max(-140, Math.min(140, bioCenter - contactCenter));
        heroCopy.style.setProperty("--hero-copy-align-y", `${offset.toFixed(1)}px`);
    };

    let heroActionAlignFrame = 0;
    const scheduleHeroActionAlignment = () => {
        window.cancelAnimationFrame(heroActionAlignFrame);
        heroActionAlignFrame = window.requestAnimationFrame(alignHeroActions);
    };

    scheduleHeroActionAlignment();
    window.addEventListener("resize", scheduleHeroActionAlignment, { passive: true });
    window.addEventListener("load", scheduleHeroActionAlignment, { once: true });
    document.fonts?.ready?.then(scheduleHeroActionAlignment);

    if ("ResizeObserver" in window && currentRole) {
        const heroActionAlignObserver = new ResizeObserver(scheduleHeroActionAlignment);
        heroActionAlignObserver.observe(currentRole);
        heroActionAlignObserver.observe(heroVisual);
    }

    const bayer8 = [
        0, 32, 8, 40, 2, 34, 10, 42,
        48, 16, 56, 24, 50, 18, 58, 26,
        12, 44, 4, 36, 14, 46, 6, 38,
        60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41,
        51, 19, 59, 27, 49, 17, 57, 25,
        15, 47, 7, 39, 13, 45, 5, 37,
        63, 31, 55, 23, 61, 29, 53, 21
    ];

    const palette = [
        [8, 2, 15],
        [34, 8, 52],
        [83, 27, 143],
        [125, 61, 255],
        [255, 103, 26],
        [255, 195, 41],
        [248, 242, 255]
    ];

    const portraitSampleCanvas = document.createElement("canvas");
    const portraitSampleContext = portraitSampleCanvas.getContext("2d", { willReadFrequently: true });
    const portraitDitherContext = ditherCanvas.getContext("2d");
    const portraitCycleContext = portraitCycleCanvas.getContext("2d");
    const glitchContext = glitchCanvas.getContext("2d");
    let glitchSourceImage = null;
    let glitchOutputImage = null;
    let cyclePrimarySourceImage = null;
    let cyclePrimaryDitherImage = null;
    let cycleAlternateSourceImage = null;
    let cycleAlternateDitherImage = null;
    let cycleOutputImage = null;
    let lastCycleFrame = 0;
    let cycleStartedAt = null;
    let cycleIndex = -1;
    let cycleCurrentAlternate = false;
    let cycleTargetAlternate = true;
    let lensX = 48;
    let lensY = 31;

    const smoothstep = (value) => {
        const clamped = Math.max(0, Math.min(1, value));
        return clamped * clamped * (3 - (2 * clamped));
    };

    const renderPortraitCycle = (time = performance.now()) => {
        if (
            !cyclePrimarySourceImage ||
            !cyclePrimaryDitherImage ||
            !cycleAlternateSourceImage ||
            !cycleAlternateDitherImage ||
            !cycleOutputImage ||
            !portraitCycleContext
        ) return;

        const waveDuration = 6667;
        const pauseDuration = 2500;
        const cycleDuration = waveDuration + pauseDuration;
        if (cycleStartedAt === null) cycleStartedAt = time;
        const elapsed = Math.max(0, time - cycleStartedAt);
        const nextCycleIndex = Math.floor(elapsed / cycleDuration);

        if (nextCycleIndex !== cycleIndex) {
            if (cycleIndex >= 0) {
                cycleCurrentAlternate = cycleTargetAlternate;
            }
            cycleIndex = nextCycleIndex;
            cycleTargetAlternate = !cycleCurrentAlternate;
        }

        const cycleElapsed = elapsed % cycleDuration;
        const reveal = smoothstep(Math.min(cycleElapsed / waveDuration, 1));
        // Travel beyond both edges so the scan creeps in from above and fully
        // clears the bottom before the resting interval begins.
        const scanPosition = -0.1 + (reveal * 1.2);
        const currentCleanSource = cycleCurrentAlternate ? cycleAlternateSourceImage.data : cyclePrimarySourceImage.data;
        const currentDitherSource = cycleCurrentAlternate ? cycleAlternateDitherImage.data : cyclePrimaryDitherImage.data;
        const targetCleanSource = cycleTargetAlternate ? cycleAlternateSourceImage.data : cyclePrimarySourceImage.data;
        const targetDitherSource = cycleTargetAlternate ? cycleAlternateDitherImage.data : cyclePrimaryDitherImage.data;
        const output = cycleOutputImage.data;
        const width = cyclePrimarySourceImage.width;
        const height = cyclePrimarySourceImage.height;
        const lensCenterX = width * (lensX / 100);
        const lensCenterY = height * (lensY / 100);
        const lensHalfWidth = width * ((clarityLens.offsetWidth / Math.max(heroVisual.clientWidth, 1)) / 2);
        const lensHalfHeight = height * ((clarityLens.offsetHeight / Math.max(heroVisual.clientHeight, 1)) / 2);

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = (y * width + x) * 4;
                const verticalPosition = y / Math.max(height - 1, 1);
                const ditherX = Math.floor(x / 2) % 8;
                const ditherY = Math.floor(y / 2) % 8;
                const dither = ((bayer8[ditherY * 8 + ditherX] / 63) - 0.5) * 0.13;
                const visible = verticalPosition <= scanPosition + dither;
                const insideLens = Math.abs(x - lensCenterX) <= lensHalfWidth && Math.abs(y - lensCenterY) <= lensHalfHeight;
                const source = visible
                    ? (insideLens ? targetCleanSource : targetDitherSource)
                    : (insideLens ? currentCleanSource : currentDitherSource);
                output[index] = source[index];
                output[index + 1] = source[index + 1];
                output[index + 2] = source[index + 2];
                output[index + 3] = 255;
            }
        }

        portraitCycleContext.putImageData(cycleOutputImage, 0, 0);
        // The glitch must sample the exact composite currently on screen. This
        // keeps it synchronized with both photos while the scan crosses the lens.
        glitchSourceImage = cycleOutputImage;
        if (
            glitchContext &&
            (!glitchOutputImage ||
                glitchOutputImage.width !== cycleOutputImage.width ||
                glitchOutputImage.height !== cycleOutputImage.height)
        ) {
            glitchOutputImage = glitchContext.createImageData(cycleOutputImage.width, cycleOutputImage.height);
        }
    };

    const renderGlitchFrame = (time = performance.now()) => {
        if (!glitchSourceImage || !glitchOutputImage || !glitchContext) return;
        const source = glitchSourceImage.data;
        const output = glitchOutputImage.data;
        const width = glitchSourceImage.width;
        const height = glitchSourceImage.height;
        const phase = Math.floor(time / 68);
        const clampX = (value) => Math.max(0, Math.min(width - 1, value));

        for (let y = 0; y < height; y += 1) {
            const band = Math.floor(y / 5);
            const sliceOffset = ((band + phase) % 7 === 0) ? ((((band * 3) + phase) % 3) - 1) * 11 : 0;
            const signalLine = ((y + (phase * 3)) % 23) < 2;
            for (let x = 0; x < width; x += 1) {
                const outputIndex = (y * width + x) * 4;
                const baseX = clampX(x + sliceOffset);
                const redIndex = (y * width + clampX(baseX + 4)) * 4;
                const greenIndex = (y * width + baseX) * 4;
                const blueIndex = (y * width + clampX(baseX - 4)) * 4;
                const quantize = (value) => Math.min(255, Math.round(value / 32) * 32);
                const shiftedLuminance = (source[redIndex] * 0.299) + (source[greenIndex + 1] * 0.587) + (source[blueIndex + 2] * 0.114);
                const monochrome = signalLine ? 255 : quantize(shiftedLuminance);
                output[outputIndex] = monochrome;
                output[outputIndex + 1] = monochrome;
                output[outputIndex + 2] = monochrome;
                output[outputIndex + 3] = 255;
            }
        }

        glitchContext.putImageData(glitchOutputImage, 0, 0);
    };

    const drawPortraitDither = () => {
        if (!heroSource.complete || !heroSource.naturalWidth || !portraitSampleContext || !portraitDitherContext) return;

        const rect = heroVisual.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const targetRatio = rect.width / rect.height;
        let targetWidth = Math.min(560, Math.max(280, Math.round(rect.width)));
        let targetHeight = Math.round(targetWidth / targetRatio);
        if (targetHeight > 720) {
            targetHeight = 720;
            targetWidth = Math.round(targetHeight * targetRatio);
        }

        portraitSampleCanvas.width = targetWidth;
        portraitSampleCanvas.height = targetHeight;
        ditherCanvas.width = targetWidth;
        ditherCanvas.height = targetHeight;
        portraitCycleCanvas.width = targetWidth;
        portraitCycleCanvas.height = targetHeight;
        glitchCanvas.width = targetWidth;
        glitchCanvas.height = targetHeight;

        const sourceWidth = heroSource.naturalWidth;
        const sourceHeight = heroSource.naturalHeight;
        const sourceRatio = sourceWidth / sourceHeight;
        let sx = 0;
        let sy = 0;
        let sw = sourceWidth;
        let sh = sourceHeight;

        if (sourceRatio > targetRatio) {
            sw = sourceHeight * targetRatio;
            sx = (sourceWidth - sw) * 0.5;
        } else {
            sh = sourceWidth / targetRatio;
            sy = (sourceHeight - sh) * 0.2;
        }

        portraitSampleContext.clearRect(0, 0, targetWidth, targetHeight);
        portraitSampleContext.drawImage(heroSource, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        const portraitSource = portraitSampleContext.getImageData(0, 0, targetWidth, targetHeight);
        const portraitOutput = portraitDitherContext.createImageData(targetWidth, targetHeight);

        for (let y = 0; y < targetHeight; y += 1) {
            for (let x = 0; x < targetWidth; x += 1) {
                const index = (y * targetWidth + x) * 4;
                const red = portraitSource.data[index];
                const green = portraitSource.data[index + 1];
                const blue = portraitSource.data[index + 2];
                const luminance = (red * 0.299) + (green * 0.587) + (blue * 0.114);
                const ditherX = Math.floor(x / 2) % 8;
                const ditherY = Math.floor(y / 2) % 8;
                const threshold = (bayer8[ditherY * 8 + ditherX] / 64) - 0.5;
                const warmth = (red - blue) / 255;
                const normalized = Math.max(0, Math.min(1, (luminance / 255) + threshold * 0.19 + warmth * 0.05));
                const level = Math.min(palette.length - 1, Math.floor(normalized * palette.length));
                const [outRed, outGreen, outBlue] = palette[level];
                portraitOutput.data[index] = outRed;
                portraitOutput.data[index + 1] = outGreen;
                portraitOutput.data[index + 2] = outBlue;
                portraitOutput.data[index + 3] = 255;
            }
        }

        portraitDitherContext.putImageData(portraitOutput, 0, 0);
        cyclePrimarySourceImage = portraitSource;
        cyclePrimaryDitherImage = portraitOutput;

        if (heroAlternateSource.complete && heroAlternateSource.naturalWidth) {
            const alternateWidth = heroAlternateSource.naturalWidth;
            const alternateHeight = heroAlternateSource.naturalHeight;
            const alternateRatio = alternateWidth / alternateHeight;
            let alternateX = 0;
            let alternateY = 0;
            let alternateCropWidth = alternateWidth;
            let alternateCropHeight = alternateHeight;

            if (alternateRatio > targetRatio) {
                alternateCropWidth = alternateHeight * targetRatio;
                alternateX = (alternateWidth - alternateCropWidth) * 0.56;
            } else {
                alternateCropHeight = alternateWidth / targetRatio;
                alternateY = (alternateHeight - alternateCropHeight) * 0.28;
            }

            portraitSampleContext.clearRect(0, 0, targetWidth, targetHeight);
            portraitSampleContext.drawImage(
                heroAlternateSource,
                alternateX,
                alternateY,
                alternateCropWidth,
                alternateCropHeight,
                0,
                0,
                targetWidth,
                targetHeight
            );
            cycleAlternateSourceImage = portraitSampleContext.getImageData(0, 0, targetWidth, targetHeight);
            cycleAlternateDitherImage = portraitCycleContext.createImageData(targetWidth, targetHeight);

            for (let y = 0; y < targetHeight; y += 1) {
                for (let x = 0; x < targetWidth; x += 1) {
                    const index = (y * targetWidth + x) * 4;
                    const red = cycleAlternateSourceImage.data[index];
                    const green = cycleAlternateSourceImage.data[index + 1];
                    const blue = cycleAlternateSourceImage.data[index + 2];
                    const luminance = (red * 0.299) + (green * 0.587) + (blue * 0.114);
                    const ditherX = Math.floor(x / 2) % 8;
                    const ditherY = Math.floor(y / 2) % 8;
                    const threshold = (bayer8[ditherY * 8 + ditherX] / 64) - 0.5;
                    const warmth = (red - blue) / 255;
                    const normalized = Math.max(0, Math.min(1, (luminance / 255) + threshold * 0.19 + warmth * 0.05));
                    const level = Math.min(palette.length - 1, Math.floor(normalized * palette.length));
                    const [outRed, outGreen, outBlue] = palette[level];
                    cycleAlternateDitherImage.data[index] = outRed;
                    cycleAlternateDitherImage.data[index + 1] = outGreen;
                    cycleAlternateDitherImage.data[index + 2] = outBlue;
                    cycleAlternateDitherImage.data[index + 3] = 255;
                }
            }

            cycleOutputImage = portraitCycleContext.createImageData(targetWidth, targetHeight);
            cycleStartedAt = null;
            cycleIndex = -1;
            cycleCurrentAlternate = false;
            cycleTargetAlternate = true;
            portraitDitherContext.putImageData(cyclePrimaryDitherImage, 0, 0);
            renderPortraitCycle();
            root.classList.add("portrait-cycle-ready");
        }

        glitchSourceImage = cycleOutputImage || portraitSource;
        glitchOutputImage = glitchContext.createImageData(targetWidth, targetHeight);
        renderGlitchFrame();
        root.classList.add("portrait-dither-ready");
    };

    if (heroSource.complete) {
        drawPortraitDither();
    } else {
        heroSource.addEventListener("load", drawPortraitDither, { once: true });
    }

    if (!heroAlternateSource.naturalWidth) {
        heroAlternateSource.addEventListener("load", drawPortraitDither, { once: true });
    }

    if ("ResizeObserver" in window) {
        let resizeFrame = 0;
        const portraitResize = new ResizeObserver(() => {
            window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(drawPortraitDither);
        });
        portraitResize.observe(heroVisual);
    } else {
        window.addEventListener("resize", drawPortraitDither, { passive: true });
    }

    let targetLensX = lensX;
    let targetLensY = lensY;
    let pointerControlsLens = false;
    let lensResumeTimer = 0;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let glitchActive = false;
    let glitchHeld = false;
    let glitchMinimumEnd = 0;
    let glitchStopTimer = 0;
    let lastGlitchFrame = 0;

    const stopGlitchImmediately = () => {
        window.clearTimeout(glitchStopTimer);
        glitchHeld = false;
        glitchActive = false;
        heroVisual.classList.remove("is-glitching");
    };

    const startGlitch = () => {
        window.clearTimeout(glitchStopTimer);
        glitchHeld = true;
        glitchActive = true;
        glitchMinimumEnd = performance.now() + 400;
        renderGlitchFrame();
        heroVisual.classList.add("is-glitching");
    };

    const releaseGlitch = () => {
        glitchHeld = false;
        const remaining = Math.max(0, glitchMinimumEnd - performance.now());
        window.clearTimeout(glitchStopTimer);
        glitchStopTimer = window.setTimeout(() => {
            if (!glitchHeld) stopGlitchImmediately();
        }, remaining);
    };

    const lensBounds = () => {
        const visualRect = heroVisual.getBoundingClientRect();
        const halfWidth = Math.max(clarityLens.offsetWidth / 2, 72);
        const halfHeight = Math.max(clarityLens.offsetHeight / 2, 48);
        const insetX = Math.min(42, ((halfWidth + 6) / visualRect.width) * 100);
        const insetY = Math.min(32, ((halfHeight + 6) / visualRect.height) * 100);
        return {
            minX: insetX,
            maxX: 100 - insetX,
            minY: insetY,
            maxY: Math.min(82, 100 - insetY)
        };
    };

    const clampLens = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

    const pointLensAt = (clientX, clientY) => {
        const rect = heroVisual.getBoundingClientRect();
        const bounds = lensBounds();
        targetLensX = clampLens(((clientX - rect.left) / rect.width) * 100, bounds.minX, bounds.maxX);
        targetLensY = clampLens(((clientY - rect.top) / rect.height) * 100, bounds.minY, bounds.maxY);
        lensX = targetLensX;
        lensY = targetLensY;
        heroVisual.style.setProperty("--lens-x", `${lensX.toFixed(3)}%`);
        heroVisual.style.setProperty("--lens-y", `${lensY.toFixed(3)}%`);
    };

    const resumeAutonomousLens = (delay = 650) => {
        window.clearTimeout(lensResumeTimer);
        lensResumeTimer = window.setTimeout(() => {
            pointerControlsLens = false;
            heroVisual.classList.remove("is-hovered");
        }, delay);
    };

    heroVisual.addEventListener("pointerenter", (event) => {
        if (!finePointer.matches) return;
        window.clearTimeout(lensResumeTimer);
        pointerControlsLens = true;
        heroVisual.classList.add("is-hovered");
        pointLensAt(event.clientX, event.clientY);
    });

    heroVisual.addEventListener("pointermove", (event) => {
        if (!pointerControlsLens) return;
        pointLensAt(event.clientX, event.clientY);
    });

    heroVisual.addEventListener("pointerleave", () => resumeAutonomousLens());

    heroVisual.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".current-role")) return;
        if (event.button !== 0 || event.isPrimary === false) return;
        window.clearTimeout(lensResumeTimer);
        pointerControlsLens = true;
        heroVisual.classList.add("is-hovered");
        pointLensAt(event.clientX, event.clientY);
        heroVisual.setPointerCapture?.(event.pointerId);
        startGlitch();
        if (!finePointer.matches) resumeAutonomousLens(1200);
    });

    heroVisual.addEventListener("pointerup", releaseGlitch);
    heroVisual.addEventListener("pointercancel", releaseGlitch);
    window.addEventListener("blur", stopGlitchImmediately);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopGlitchImmediately();
    });

    const animateLens = (time) => {
        if (time - lastCycleFrame >= 50) {
            renderPortraitCycle(time);
            lastCycleFrame = time;
        }

        if (glitchActive && time - lastGlitchFrame >= 68) {
            renderGlitchFrame(time);
            lastGlitchFrame = time;
        }

        if (!pointerControlsLens) {
            const speed = reduceMotion.matches ? 0.00018 : 0.00032;
            const phase = time * speed;
            const bounds = lensBounds();
            const travel = reduceMotion.matches ? 0.45 : 1;
            const orbitX = heroVisual.clientWidth < 500 ? 6.5 : 8;
            const orbitY = heroVisual.clientWidth < 500 ? 4.5 : 5.5;
            const faceX = 48;
            const faceY = 31;
            targetLensX = clampLens(faceX + ((Math.sin(phase) * orbitX) + (Math.sin(phase * 2.1) * 1.2)) * travel, bounds.minX, bounds.maxX);
            targetLensY = clampLens(faceY + ((Math.cos(phase) * orbitY) + (Math.sin(phase * 1.55) * 0.8)) * travel, bounds.minY, bounds.maxY);
        }

        if (!pointerControlsLens) {
            lensX += (targetLensX - lensX) * 0.045;
            lensY += (targetLensY - lensY) * 0.045;
        }
        heroVisual.style.setProperty("--lens-x", `${lensX.toFixed(3)}%`);
        heroVisual.style.setProperty("--lens-y", `${lensY.toFixed(3)}%`);
        if (spyCoordinates) spyCoordinates.textContent = `X ${lensX.toFixed(1)} / Y ${lensY.toFixed(1)}`;
        window.requestAnimationFrame(animateLens);
    };

    window.requestAnimationFrame(animateLens);

    const careerTrack = document.querySelector(".career-track");
    if (careerTrack) {
        const showCurrentRole = () => {
            careerTrack.scrollLeft = careerTrack.scrollWidth - careerTrack.clientWidth;
        };
        window.requestAnimationFrame(() => window.requestAnimationFrame(showCurrentRole));
    }

    const universityData = {
        columbia: { name: "Columbia University", city: "New York, NY", date: "November 2025", description: "Disrupt the narrative: Conversations that shape community (Lecture)", logo: "images/universities/columbia.png", link: "https://www.instagram.com/p/DQ4Y_oAEQMx/?img_index=1", ivy: true },
        stanford: { name: "Stanford d.school", city: "Stanford, CA", date: "May 2025", description: "XR Prototyping with AI (Lecture)", logo: "images/universities/stanford.png", link: "https://www.linkedin.com/in/manuvision/details/recommendations/?detailScreenTabIndex=1" },
        oxford: { name: "Oxford University", city: "Oxford, UK", date: "April 2025", description: "OpenAI Sora Project & Workflow Breakdown (Lecture)", logo: "images/universities/oxford.png", link: "https://lifelong-learning.ox.ac.uk/courses/generative-ai-for-creative-professionals" },
        harvard: { name: "Harvard University", city: "Cambridge, MA", date: "April 2025", description: "HarvardXR 2025: The Augmented Self (Lecture)", logo: "images/universities/harvard.png", link: "https://www.youtube.com/watch?v=9ozmGsu9g3o", ivy: true },
        ucsd: { name: "UC San Diego", city: "San Diego, CA", date: "March 2025", description: "HackXR (XR Hackathon)", logo: "images/universities/ucsd.png", link: "https://www.youtube.com/shorts/juuCQhf9_MY" },
        mit: { name: "MIT", city: "Cambridge, MA", date: "January 2025", description: "AI & Creative Technology (Lecture)", logo: "images/universities/mit.png", link: "https://www.instagram.com/p/DFXsojMRgtf/" },
        ocad: { name: "OCAD University", city: "Toronto, Canada", date: "February 2024", description: "Protopica: Challenging mainstream narratives through world building (Lecture)", logo: "images/universities/ocad.png", link: "https://www.instagram.com/p/C3X5hKvAHQg/" },
        umass: { name: "UMass Boston", city: "Boston, MA", date: "November 2023 & October 2024", description: "AI & XR for Cultural Heritage Preservation (Lectures)", logo: "images/universities/umass-boston.png", link: "https://www.instagram.com/p/DBRZFSUAicg/?img_index=1" },
        mcgill: { name: "McGill University", city: "Montreal, Canada", date: "September 2023", description: "Learn AR/VR (Curriculum)", logo: "images/universities/mcgill.png", link: "https://www.instagram.com/p/Cu5VPnRgPvw/" }
    };

    const universityDialog = document.getElementById("universityDialog");
    const universityDialogLogo = document.getElementById("universityDialogLogo");
    const universityDialogCity = document.getElementById("universityDialogCity");
    const universityDialogTitle = document.getElementById("universityDialogTitle");
    const universityDialogBadge = document.getElementById("universityDialogBadge");
    const universityDialogDate = document.getElementById("universityDialogDate");
    const universityDialogDescription = document.getElementById("universityDialogDescription");
    const universityDialogLink = document.getElementById("universityDialogLink");

    document.querySelectorAll("[data-university]").forEach((trigger) => {
        trigger.addEventListener("click", () => {
            const university = universityData[trigger.dataset.university];
            if (!university || typeof universityDialog.showModal !== "function") return;
            universityDialogLogo.src = university.logo;
            universityDialogLogo.alt = `${university.name} logo`;
            universityDialogCity.textContent = university.city;
            universityDialogTitle.textContent = university.name;
            universityDialogBadge.hidden = !university.ivy;
            universityDialogDate.textContent = university.date;
            universityDialogDescription.textContent = university.description;
            universityDialogLink.href = university.link;
            universityDialog.showModal();
            body.classList.add("is-locked");
        });
    });

    const dialogTriggers = document.querySelectorAll("[data-dialog]");
    const dialogs = document.querySelectorAll("dialog.detail-dialog");

    dialogTriggers.forEach((trigger) => {
        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            const dialog = document.getElementById(trigger.dataset.dialog);
            if (!dialog || typeof dialog.showModal !== "function") return;
            dialog.showModal();
            body.classList.add("is-locked");
        });
    });

    dialogs.forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener("close", () => body.classList.remove("is-locked"));
    });

    // Load the large point-cloud dataset only when the final section is near.
    const pointcloudCanvas = document.getElementById("contactPointcloudCanvas");
    const pointcloudFigure = pointcloudCanvas?.closest(".contact-pointcloud");
    let pointcloudStarted = false;

    const startPointcloud = async () => {
        if (pointcloudStarted || !pointcloudCanvas) return;
        pointcloudStarted = true;

        try {
            const response = await fetch("pointcloud.html");
            if (!response.ok) throw new Error(`Point-cloud data returned ${response.status}`);
            const sourceDocument = await response.text();
            const source = sourceDocument.match(/<script>([\s\S]*?)<\/script>/)?.[1];
            if (!source) throw new Error("Point-cloud data script was not found");

            const integratedSource = source
                .replaceAll("document.getElementById('c')", "document.getElementById('contactPointcloudCanvas')")
                .replaceAll("document.getElementById('reset')", "document.getElementById('contactPointcloudReset')");
            new Function(integratedSource)();
            pointcloudFigure?.classList.add("is-ready");
        } catch (error) {
            console.error("Point-cloud experiment could not start.", error);
            pointcloudFigure?.classList.add("is-unavailable");
        }
    };

    if (pointcloudFigure && "IntersectionObserver" in window) {
        const pointcloudObserver = new IntersectionObserver((entries, observer) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            startPointcloud();
        }, { rootMargin: "500px 0px", threshold: 0.01 });
        pointcloudObserver.observe(pointcloudFigure);
    } else {
        startPointcloud();
    }
})();
