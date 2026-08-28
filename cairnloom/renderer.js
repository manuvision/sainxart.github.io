/*
 * Cairnloom's battlefield is intentionally rendered without image assets.  The
 * shapes below use the same light parchment, soft moss, and matte-paper visual
 * language as the rest of the interface while keeping every gameplay mark
 * legible at phone sizes.
 */

const COLORS = Object.freeze({
  ink: "#242118",
  inkSoft: "#514b3e",
  moss: "#939b80",
  mossLight: "#b8bca0",
  mossDeep: "#667260",
  sage: "#c8cbb0",
  paper: "#eee5d2",
  paperLight: "#fffaf0",
  paperDeep: "#d4c7ae",
  ember: "#e96b38",
  emberHot: "#ff9251",
  emberPale: "#ffd184",
  oxblood: "#7b3a31",
  blue: "#688897",
  blueLight: "#b9d5dc",
  gold: "#c49c4b",
  danger: "#aa4b3d",
  health: "#738a5c",
  shield: "#719bad",
  violet: "#817091",
});

const TOWER_KIND_ALIASES = Object.freeze({
  ashbolt: "sentinel",
  ashbolt_turret: "sentinel",
  bolt: "sentinel",
  sentinel: "sentinel",
  cinder_mortar: "mortar",
  mortar: "mortar",
  brand_brazier: "pyre",
  brazier: "pyre",
  brand: "pyre",
  pyre: "pyre",
  rime_bell: "frost",
  rime: "frost",
  frost: "frost",
  storm_reliquary: "arc",
  reliquary: "arc",
  storm: "arc",
  arc: "arc",
});

const DEFAULT_RANGES = Object.freeze({
  sentinel: 2.85,
  mortar: 2.75,
  pyre: 2.7,
  frost: 2.7,
  arc: 2.85,
});

const DEFAULT_PATH = Object.freeze([
  { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
  { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 },
  { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 },
  { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
  { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 },
  { x: 2, y: 7 }, { x: 1, y: 7 }, { x: 1, y: 8 }, { x: 1, y: 9 },
  { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 4, y: 10 },
  { x: 4, y: 11 },
]);

const DEFAULT_PADS = Object.freeze([
  { id: "pad-demo-1", x: 1, y: 1 }, { id: "pad-demo-2", x: 3, y: 2 },
  { id: "pad-demo-3", x: 6, y: 3 }, { id: "pad-demo-4", x: 0, y: 4 },
  { id: "pad-demo-5", x: 3, y: 4 }, { id: "pad-demo-6", x: 6, y: 6 },
  { id: "pad-demo-7", x: 3, y: 6 }, { id: "pad-demo-8", x: 0, y: 8 },
  { id: "pad-demo-9", x: 5, y: 9 }, { id: "pad-demo-10", x: 2, y: 10 },
]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function normalizeId(value) {
  return value == null ? "" : String(value);
}

function towerKind(value) {
  const raw = normalizeId(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (TOWER_KIND_ALIASES[raw]) return TOWER_KIND_ALIASES[raw];
  if (raw.includes("mortar") || raw.includes("bomb")) return "mortar";
  if (raw.includes("brand") || raw.includes("pyre") || raw.includes("fire")) return "pyre";
  if (raw.includes("frost") || raw.includes("rime") || raw.includes("slow")) return "frost";
  if (raw.includes("arc") || raw.includes("storm") || raw.includes("chain")) return "arc";
  return "sentinel";
}

function mobKind(value, isBoss = false) {
  if (isBoss) return "boss";
  const raw = normalizeId(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (raw.includes("coloss") || raw.includes("boss")) return "boss";
  if (raw.includes("mite") || raw.includes("swarm") || raw.includes("runner")) return "mite";
  if (raw.includes("brute")) return "brute";
  if (raw.includes("iron") || raw.includes("armor") || raw.includes("guard")) return "ironbound";
  if (raw.includes("wisp") || raw.includes("veil") || raw.includes("spirit")) return "wisp";
  if (raw.includes("hulk") || raw.includes("tank") || raw.includes("siege")) return "hulk";
  return "ashling";
}

function mapFromRun(run) {
  const source = run?.map && typeof run.map === "object" ? run.map : {};
  const cols = Math.round(clamp(positiveNumber(source.width ?? source.cols, 7), 2, 32));
  const rows = Math.round(clamp(positiveNumber(source.height ?? source.rows, 12), 2, 64));
  const pathSource = Array.isArray(source.path) && source.path.length > 1 ? source.path : DEFAULT_PATH;
  const path = pathSource
    .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
    .map((point) => ({ x: finiteNumber(point.x), y: finiteNumber(point.y) }));
  const padSource = source.buildPads ?? source.pads;
  const pads = (Array.isArray(padSource) ? padSource : DEFAULT_PADS)
    .filter((pad) => pad && Number.isFinite(Number(pad.x)) && Number.isFinite(Number(pad.y)))
    .map((pad, index) => ({ ...pad, id: normalizeId(pad.id || `pad-${index + 1}`), x: finiteNumber(pad.x), y: finiteNumber(pad.y) }));

  return {
    ...source,
    cols,
    rows,
    path: path.length > 1 ? path : DEFAULT_PATH.map((point) => ({ ...point })),
    pads,
    entrance: source.entrance || path[0] || DEFAULT_PATH[0],
    base: source.base || path.at(-1) || DEFAULT_PATH.at(-1),
    decor: Array.isArray(source.decor) ? source.decor : [],
  };
}

function cssCanvasSize(canvas, requestedDpr) {
  let rect = null;
  try {
    rect = canvas?.getBoundingClientRect?.() || null;
  } catch {
    rect = null;
  }
  const globalDpr = typeof globalThis !== "undefined" ? globalThis.devicePixelRatio : 1;
  const dpr = clamp(positiveNumber(requestedDpr, positiveNumber(globalDpr, 1)), 1, 4);
  const width = positiveNumber(rect?.width, positiveNumber(canvas?.clientWidth, positiveNumber(canvas?.width, 390) / dpr));
  const height = positiveNumber(rect?.height, positiveNumber(canvas?.clientHeight, positiveNumber(canvas?.height, 520) / dpr));
  return { width: Math.max(1, width), height: Math.max(1, height), dpr, rect };
}

function gridPoint(layout, x, y) {
  return {
    x: layout.grid.left + (finiteNumber(x) + 0.5) * layout.cellWidth,
    y: layout.grid.top + (finiteNumber(y) + 0.5) * layout.cellHeight,
  };
}

function canonicalMobGridPosition(map, mob) {
  if (Number.isFinite(Number(mob?.x)) && Number.isFinite(Number(mob?.y))) {
    return { x: Number(mob.x), y: Number(mob.y) };
  }
  const path = map.path;
  if (!path.length) return { x: 0, y: 0 };
  const lastIndex = path.length - 1;
  let progress;
  if (Number.isFinite(Number(mob?.progress))) {
    // The Cairnloom engine measures progress in path segments.
    progress = Number(mob.progress);
  } else if (Number.isFinite(Number(mob?.pathProgress))) {
    // pathProgress is accepted as a friendlier normalized alias.
    const pathProgress = Number(mob.pathProgress);
    progress = pathProgress >= 0 && pathProgress <= 1 ? pathProgress * lastIndex : pathProgress;
  } else {
    progress = 0;
  }

  if (progress <= 0) {
    const first = path[0];
    const second = path[1] || { x: first.x, y: first.y + 1 };
    return { x: first.x + (second.x - first.x) * progress, y: first.y + (second.y - first.y) * progress };
  }
  if (progress >= lastIndex) {
    const previous = path[Math.max(0, lastIndex - 1)];
    const last = path[lastIndex];
    const excess = progress - lastIndex;
    return { x: last.x + (last.x - previous.x) * excess, y: last.y + (last.y - previous.y) * excess };
  }
  const segment = Math.floor(progress);
  const portion = progress - segment;
  return {
    x: mix(path[segment].x, path[segment + 1].x, portion),
    y: mix(path[segment].y, path[segment + 1].y, portion),
  };
}

function listFromRun(run, primary, alias) {
  if (Array.isArray(run?.[primary])) return run[primary];
  if (Array.isArray(run?.[alias])) return run[alias];
  return [];
}

function makeIdSet(value) {
  if (value instanceof Set) return new Set([...value].map(normalizeId));
  if (Array.isArray(value)) return new Set(value.map((item) => normalizeId(item?.id ?? item)));
  return null;
}

function buildLayout(canvas, run, options = {}) {
  const size = cssCanvasSize(canvas, options.dpr);
  const map = mapFromRun(run);
  const insetX = clamp(size.width * 0.035, 10, 18);
  const insetY = clamp(Math.min(size.height * 0.025, size.width * 0.03), 9, 16);
  const grid = {
    left: insetX,
    top: insetY,
    width: Math.max(1, size.width - insetX * 2),
    height: Math.max(1, size.height - insetY * 2),
  };
  const cellWidth = grid.width / map.cols;
  const cellHeight = grid.height / map.rows;
  const unit = Math.min(cellWidth, cellHeight);
  const occupiedPadIds = new Set();
  const padById = new Map(map.pads.map((pad) => [normalizeId(pad.id), pad]));
  const rawTowers = listFromRun(run, "towers", "defenses");
  const towers = rawTowers.map((tower, index) => {
    const pad = padById.get(normalizeId(tower?.padId));
    const gridX = finiteNumber(tower?.x, finiteNumber(pad?.x));
    const gridY = finiteNumber(tower?.y, finiteNumber(pad?.y));
    const point = gridPoint({ grid, cellWidth, cellHeight }, gridX, gridY);
    const id = normalizeId(tower?.id || `tower-${index + 1}`);
    const padId = normalizeId(tower?.padId || pad?.id);
    if (padId) occupiedPadIds.add(padId);
    const kind = towerKind(tower?.typeId ?? tower?.type ?? tower?.kind);
    return {
      ...tower,
      id,
      padId,
      kind,
      towerType: tower?.typeId ?? tower?.type ?? kind,
      gridX,
      gridY,
      cx: point.x,
      cy: point.y,
      level: Math.max(1, Math.round(positiveNumber(tower?.level, 1))),
      hitRadius: clamp(unit * 0.72, 24, 34),
    };
  });

  const requestedValid = makeIdSet(options.validPadIds);
  const placing = Boolean(options.selectedTowerType);
  const pads = map.pads.map((pad) => {
    const point = gridPoint({ grid, cellWidth, cellHeight }, pad.x, pad.y);
    const id = normalizeId(pad.id);
    const occupied = occupiedPadIds.has(id);
    return {
      ...pad,
      id,
      cx: point.x,
      cy: point.y,
      radius: clamp(unit * 0.48, 15, 22),
      hitRadius: clamp(unit * 0.72, 24, 32),
      occupied,
      valid: !occupied && (requestedValid ? requestedValid.has(id) : placing),
    };
  });

  const rawMobs = listFromRun(run, "mobs", "enemies");
  const mobs = rawMobs.map((mob, index) => {
    const position = canonicalMobGridPosition(map, mob);
    const point = gridPoint({ grid, cellWidth, cellHeight }, position.x, position.y);
    const isBoss = Boolean(mob?.isBoss ?? mob?.boss) || mobKind(mob?.typeId ?? mob?.type, false) === "boss";
    const kind = mobKind(mob?.typeId ?? mob?.type ?? mob?.kind, isBoss);
    const scale = clamp(unit * (isBoss ? 0.72 : kind === "hulk" ? 0.59 : kind === "mite" ? 0.38 : 0.48), isBoss ? 20 : 12, isBoss ? 34 : 24);
    return {
      ...mob,
      id: normalizeId(mob?.id || `mob-${index + 1}`),
      kind,
      isBoss,
      gridX: position.x,
      gridY: position.y,
      cx: point.x,
      cy: point.y,
      scale,
    };
  });

  const path = map.path.map((point, index) => ({ ...point, index, ...gridPoint({ grid, cellWidth, cellHeight }, point.x, point.y) }));
  const entrancePoint = gridPoint({ grid, cellWidth, cellHeight }, map.entrance?.x ?? map.path[0]?.x, map.entrance?.y ?? map.path[0]?.y);
  const basePoint = gridPoint({ grid, cellWidth, cellHeight }, map.base?.x ?? map.path.at(-1)?.x, map.base?.y ?? map.path.at(-1)?.y);

  return {
    width: size.width,
    height: size.height,
    dpr: size.dpr,
    rect: size.rect,
    cols: map.cols,
    rows: map.rows,
    cellWidth,
    cellHeight,
    unit,
    grid,
    map,
    path,
    pads,
    towers,
    mobs,
    portal: { cx: entrancePoint.x, cy: entrancePoint.y, radius: clamp(unit * 0.72, 21, 31) },
    base: { cx: basePoint.x, cy: basePoint.y, radius: clamp(unit * 0.78, 22, 34) },
    pathWidth: clamp(unit * 0.9, 29, 43),
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
}

function polygon(ctx, points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
  ctx.closePath();
}

function setShadow(ctx, color, blur, offsetY = 0, offsetX = 0) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
}

function clearShadow(ctx) {
  setShadow(ctx, "rgba(0,0,0,0)", 0, 0, 0);
}

function stableNoise(seed, index) {
  const text = `${seed ?? "cairnloom"}:${index}`;
  let hash = 2166136261;
  for (let position = 0; position < text.length; position += 1) {
    hash ^= text.charCodeAt(position);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function fieldColors(biomeId) {
  switch (biomeId) {
    case "cinderfen": return { top: "#afb49c", bottom: "#849080", patch: "#737f72" };
    case "glassmoor": return { top: "#c0c1a8", bottom: "#93998b", patch: "#7d877c" };
    case "ashen-crown": return { top: "#b9b59f", bottom: "#888b7d", patch: "#74786f" };
    default: return { top: "#b8bca0", bottom: "#879278", patch: "#6f7c67" };
  }
}

function drawField(ctx, layout) {
  const colors = fieldColors(layout.map.biomeId);
  const gradient = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  gradient.addColorStop(0, colors.top);
  gradient.addColorStop(0.58, COLORS.moss);
  gradient.addColorStop(1, colors.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Large, barely-visible paper patches keep the field from reading as a flat
  // digital fill. They are deterministic, so animation never makes it crawl.
  for (let index = 0; index < 14; index += 1) {
    const x = stableNoise(layout.map.seed, index * 3) * layout.width;
    const y = stableNoise(layout.map.seed, index * 3 + 1) * layout.height;
    const radius = mix(layout.unit * 0.7, layout.unit * 2.2, stableNoise(layout.map.seed, index * 3 + 2));
    const wash = ctx.createRadialGradient(x, y, 0, x, y, radius);
    wash.addColorStop(0, index % 3 === 0 ? "rgba(255,250,240,0.12)" : "rgba(70,82,65,0.08)");
    wash.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255,250,240,0.08)";
  ctx.lineWidth = 1;
  for (let row = 1; row < layout.rows; row += 1) {
    if (row % 2 === 0) continue;
    const y = layout.grid.top + row * layout.cellHeight;
    ctx.beginPath();
    ctx.moveTo(layout.grid.left, y);
    ctx.lineTo(layout.grid.left + layout.grid.width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Quiet flecks suggest printed paper grain without becoming visual noise.
  ctx.fillStyle = "rgba(36,33,24,0.075)";
  const fleckCount = Math.round(clamp(layout.width * layout.height / 4200, 28, 90));
  for (let index = 0; index < fleckCount; index += 1) {
    const x = stableNoise(layout.map.seed, 100 + index * 2) * layout.width;
    const y = stableNoise(layout.map.seed, 101 + index * 2) * layout.height;
    const radius = 0.45 + stableNoise(layout.map.seed, 500 + index) * 0.85;
    circle(ctx, x, y, radius);
    ctx.fill();
  }
}

function drawFern(ctx, size) {
  ctx.strokeStyle = "rgba(67,84,61,0.46)";
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, size * 0.55);
  ctx.quadraticCurveTo(size * 0.08, 0, size * 0.45, -size * 0.5);
  ctx.stroke();
  for (let index = 0; index < 4; index += 1) {
    const y = size * 0.35 - index * size * 0.2;
    const x = size * 0.12 + index * size * 0.09;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * 0.28, y - size * 0.12);
    ctx.moveTo(x, y - size * 0.02);
    ctx.lineTo(x + size * 0.23, y - size * 0.2);
    ctx.stroke();
  }
}

function drawDecor(ctx, layout) {
  const size = clamp(layout.unit * 0.3, 7, 13);
  for (const item of layout.map.decor) {
    if (!item || !Number.isFinite(Number(item.x)) || !Number.isFinite(Number(item.y))) continue;
    const point = gridPoint(layout, item.x, item.y);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(finiteNumber(item.rotation) * Math.PI / 180);
    if (item.kind === "fern") {
      drawFern(ctx, size);
    } else if (item.kind === "charred-tree") {
      ctx.strokeStyle = "rgba(73,69,57,0.38)";
      ctx.lineWidth = Math.max(1.5, size * 0.18);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, size * 0.55);
      ctx.lineTo(-size * 0.05, -size * 0.38);
      ctx.moveTo(-size * 0.02, -size * 0.1);
      ctx.lineTo(-size * 0.38, -size * 0.42);
      ctx.moveTo(0, -size * 0.18);
      ctx.lineTo(size * 0.34, -size * 0.52);
      ctx.stroke();
    } else if (item.kind === "rune") {
      ctx.strokeStyle = "rgba(255,250,240,0.28)";
      ctx.lineWidth = 1.2;
      polygon(ctx, [[0, -size * 0.48], [size * 0.42, 0], [0, size * 0.48], [-size * 0.42, 0]]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.18, 0);
      ctx.lineTo(size * 0.18, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(91,91,75,0.34)";
      polygon(ctx, [[-size * 0.46, size * 0.24], [-size * 0.18, -size * 0.38], [size * 0.42, -size * 0.19], [size * 0.48, size * 0.28]]);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,250,240,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function tracePath(ctx, path) {
  if (!path.length) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let index = 1; index < path.length; index += 1) ctx.lineTo(path[index].x, path[index].y);
}

function drawDirectionChevron(ctx, x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = "rgba(123,58,49,0.42)";
  ctx.lineWidth = clamp(size * 0.15, 1.2, 2.2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-size * 0.38, -size * 0.42);
  ctx.lineTo(size * 0.08, 0);
  ctx.lineTo(-size * 0.38, size * 0.42);
  ctx.stroke();
  ctx.restore();
}

function pointAlongPolyline(points, distance) {
  if (!points.length) return null;
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) continue;
    if (remaining <= length) {
      const portion = remaining / length;
      return { x: mix(from.x, to.x, portion), y: mix(from.y, to.y, portion), angle: Math.atan2(dy, dx) };
    }
    remaining -= length;
  }
  const last = points.at(-1);
  const previous = points.at(-2) || last;
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - previous.y, last.x - previous.x) };
}

function drawPath(ctx, layout) {
  if (layout.path.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  setShadow(ctx, "rgba(36,33,24,0.17)", 8, 4);
  ctx.strokeStyle = "rgba(36,33,24,0.22)";
  ctx.lineWidth = layout.pathWidth + 6;
  tracePath(ctx, layout.path);
  ctx.stroke();

  clearShadow(ctx);
  ctx.strokeStyle = COLORS.paperDeep;
  ctx.lineWidth = layout.pathWidth + 2;
  tracePath(ctx, layout.path);
  ctx.stroke();

  ctx.strokeStyle = COLORS.paper;
  ctx.lineWidth = layout.pathWidth;
  tracePath(ctx, layout.path);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,250,240,0.46)";
  ctx.lineWidth = Math.max(2, layout.pathWidth * 0.12);
  tracePath(ctx, layout.path.map((point) => ({ x: point.x - 1, y: point.y - 1 })));
  ctx.stroke();

  const totalLength = layout.path.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - layout.path[index].x, point.y - layout.path[index].y), 0);
  const interval = clamp(layout.unit * 2.15, 58, 92);
  for (let distance = interval * 0.72; distance < totalLength - interval * 0.4; distance += interval) {
    const point = pointAlongPolyline(layout.path, distance);
    if (point) drawDirectionChevron(ctx, point.x, point.y, point.angle, clamp(layout.pathWidth * 0.25, 6, 10));
  }
  ctx.restore();
}

function drawPortal(ctx, portal, time) {
  const r = portal.radius;
  const pulse = 0.5 + 0.5 * Math.sin(time * 1.55);
  ctx.save();
  ctx.translate(portal.cx, portal.cy);
  setShadow(ctx, `rgba(255,209,132,${0.18 + pulse * 0.08})`, r * 0.55, 1);
  ctx.fillStyle = "rgba(255,209,132,0.28)";
  circle(ctx, 0, -r * 0.05, r * (0.78 + pulse * 0.05));
  ctx.fill();
  clearShadow(ctx);

  ctx.fillStyle = COLORS.paperLight;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(r * 0.075, 1.4, 2.2);
  ctx.beginPath();
  ctx.moveTo(-r * 0.58, r * 0.58);
  ctx.lineTo(-r * 0.58, -r * 0.08);
  ctx.bezierCurveTo(-r * 0.58, -r * 0.7, r * 0.58, -r * 0.7, r * 0.58, -r * 0.08);
  ctx.lineTo(r * 0.58, r * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#9ba28b";
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, r * 0.55);
  ctx.lineTo(-r * 0.34, -r * 0.02);
  ctx.bezierCurveTo(-r * 0.34, -r * 0.4, r * 0.34, -r * 0.4, r * 0.34, -r * 0.02);
  ctx.lineTo(r * 0.34, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(36,33,24,0.34)";
  ctx.stroke();

  ctx.fillStyle = COLORS.ember;
  polygon(ctx, [[0, -r * 0.47], [r * 0.13, -r * 0.2], [0, -r * 0.08], [-r * 0.13, -r * 0.2]]);
  ctx.fill();
  ctx.restore();
}

function drawFlame(ctx, x, y, size, fill = COLORS.ember) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.14, -size * 0.48, size * 0.7, -size * 0.2, size * 0.42, size * 0.48);
  ctx.bezierCurveTo(size * 0.2, size * 0.9, -size * 0.52, size * 0.72, -size * 0.48, size * 0.12);
  ctx.bezierCurveTo(-size * 0.45, -size * 0.28, -size * 0.06, -size * 0.46, 0, -size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBase(ctx, base, time) {
  const r = base.radius;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.15);
  ctx.save();
  ctx.translate(base.cx, base.cy);
  setShadow(ctx, `rgba(233,107,56,${0.2 + pulse * 0.1})`, r * 0.85, 1);
  ctx.fillStyle = "rgba(255,146,81,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.9, r * 0.54, 0, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);

  ctx.fillStyle = COLORS.paperLight;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(r * 0.07, 1.4, 2.4);
  roundedRect(ctx, -r * 0.48, r * 0.05, r * 0.96, r * 0.52, r * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.oxblood;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.02, r * 0.62, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawFlame(ctx, -r * 0.14, -r * 0.32 - pulse * 1.2, r * 0.38, COLORS.ember);
  drawFlame(ctx, r * 0.14, -r * 0.27 + pulse, r * 0.3, COLORS.emberPale);
  ctx.restore();
}

function drawPadRune(ctx, radius) {
  ctx.strokeStyle = "rgba(36,33,24,0.42)";
  ctx.lineWidth = clamp(radius * 0.075, 1, 1.7);
  polygon(ctx, [[0, -radius * 0.42], [radius * 0.42, 0], [0, radius * 0.42], [-radius * 0.42, 0]]);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-radius * 0.18, 0);
  ctx.lineTo(radius * 0.18, 0);
  ctx.moveTo(0, -radius * 0.18);
  ctx.lineTo(0, radius * 0.18);
  ctx.stroke();
}

function drawPads(ctx, layout, options, time) {
  const placementKind = towerKind(options.selectedTowerType);
  for (const pad of layout.pads) {
    if (pad.occupied) continue;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + pad.x * 0.7 + pad.y * 0.35);
    ctx.save();
    ctx.translate(pad.cx, pad.cy);
    if (pad.valid) {
      ctx.fillStyle = `rgba(255,209,132,${0.12 + pulse * 0.08})`;
      circle(ctx, 0, 0, pad.hitRadius);
      ctx.fill();
      ctx.strokeStyle = `rgba(233,107,56,${0.58 + pulse * 0.22})`;
      ctx.lineWidth = 2;
      circle(ctx, 0, 0, pad.radius + 4 + pulse * 1.2);
      ctx.stroke();
    }
    setShadow(ctx, "rgba(36,33,24,0.14)", 4, 2);
    ctx.fillStyle = pad.valid ? COLORS.paperLight : "rgba(238,229,210,0.82)";
    ctx.strokeStyle = pad.valid ? COLORS.ink : "rgba(36,33,24,0.36)";
    ctx.lineWidth = pad.valid ? 1.8 : 1.2;
    circle(ctx, 0, 0, pad.radius);
    ctx.fill();
    clearShadow(ctx);
    ctx.stroke();
    drawPadRune(ctx, pad.radius);
    if (pad.valid) {
      const accent = placementKind === "frost" ? COLORS.blue : placementKind === "arc" ? COLORS.gold : placementKind === "pyre" || placementKind === "mortar" ? COLORS.ember : COLORS.mossDeep;
      ctx.fillStyle = accent;
      circle(ctx, 0, 0, Math.max(2, pad.radius * 0.1));
      ctx.fill();
    }
    ctx.restore();
  }
}

function resolveRange(tower, options) {
  const explicit = tower?.range ?? tower?.stats?.range ?? options?.towerRanges?.[tower?.id] ?? options?.towerRanges?.[tower?.towerType];
  return positiveNumber(explicit, DEFAULT_RANGES[tower?.kind] || 2.75);
}

function resolveRangePreview(layout, options) {
  const selectedTower = layout.towers.find((tower) => tower.id === normalizeId(options.selectedTowerId));
  if (selectedTower) return { cx: selectedTower.cx, cy: selectedTower.cy, range: resolveRange(selectedTower, options), kind: selectedTower.kind };

  const requestedPadId = normalizeId(options.hoverPadId ?? options.placementPadId ?? options.previewPadId);
  const requestedPad = requestedPadId ? layout.pads.find((pad) => pad.id === requestedPadId) : null;
  const placement = options.placementRange;
  if (placement && typeof placement === "object") {
    const position = Number.isFinite(Number(placement.x)) && Number.isFinite(Number(placement.y))
      ? gridPoint(layout, Number(placement.x), Number(placement.y))
      : requestedPad;
    if (position) return {
      cx: position.cx ?? position.x,
      cy: position.cy ?? position.y,
      range: positiveNumber(placement.range ?? placement.radius, DEFAULT_RANGES[towerKind(options.selectedTowerType)] || 2.75),
      kind: towerKind(options.selectedTowerType),
    };
  }
  if (requestedPad && options.selectedTowerType) {
    return {
      cx: requestedPad.cx,
      cy: requestedPad.cy,
      range: positiveNumber(placement, DEFAULT_RANGES[towerKind(options.selectedTowerType)] || 2.75),
      kind: towerKind(options.selectedTowerType),
    };
  }
  return null;
}

function drawRange(ctx, layout, options) {
  const preview = resolveRangePreview(layout, options);
  if (!preview) return;
  const radiusX = preview.range * layout.cellWidth;
  const radiusY = preview.range * layout.cellHeight;
  const color = preview.kind === "frost" ? COLORS.blue : preview.kind === "arc" ? COLORS.gold : preview.kind === "mortar" || preview.kind === "pyre" ? COLORS.ember : COLORS.mossDeep;
  ctx.save();
  ctx.fillStyle = preview.kind === "frost" ? "rgba(104,136,151,0.12)" : preview.kind === "arc" ? "rgba(196,156,75,0.12)" : preview.kind === "mortar" || preview.kind === "pyre" ? "rgba(233,107,56,0.1)" : "rgba(78,91,76,0.11)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.ellipse(preview.cx, preview.cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  circle(ctx, preview.cx, preview.cy, 2.3);
  ctx.fill();
  ctx.restore();
}

function towerPalette(kind) {
  switch (kind) {
    case "mortar": return { main: COLORS.oxblood, light: "#b77964", accent: COLORS.emberPale };
    case "pyre": return { main: "#b65e3a", light: COLORS.ember, accent: COLORS.emberPale };
    case "frost": return { main: COLORS.blue, light: "#9bb4bd", accent: COLORS.paperLight };
    case "arc": return { main: "#907641", light: COLORS.gold, accent: COLORS.paperLight };
    default: return { main: COLORS.mossDeep, light: "#89937a", accent: COLORS.paperLight };
  }
}

function drawTowerPedestal(ctx, size, palette) {
  ctx.fillStyle = "rgba(36,33,24,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.4, size * 0.72, size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
  setShadow(ctx, "rgba(36,33,24,0.16)", 3, 2);
  ctx.fillStyle = COLORS.paperLight;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.065, 1.3, 2.2);
  roundedRect(ctx, -size * 0.53, size * 0.13, size * 1.06, size * 0.42, size * 0.12);
  ctx.fill();
  clearShadow(ctx);
  ctx.stroke();
  ctx.fillStyle = palette.main;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.16, size * 0.42, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(36,33,24,0.62)";
  ctx.stroke();
}

function drawSentinelTower(ctx, size, palette) {
  ctx.fillStyle = palette.main;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.065, 1.3, 2.1);
  polygon(ctx, [[-size * 0.3, size * 0.15], [-size * 0.2, -size * 0.45], [size * 0.2, -size * 0.45], [size * 0.3, size * 0.15]]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.paperLight;
  roundedRect(ctx, -size * 0.11, -size * 0.3, size * 0.22, size * 0.43, size * 0.06);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.09, 1.6, 2.8);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-size * 0.46, -size * 0.5);
  ctx.quadraticCurveTo(0, -size * 0.72, size * 0.46, -size * 0.5);
  ctx.stroke();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, -size * 0.5);
  ctx.lineTo(size * 0.42, -size * 0.5);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  polygon(ctx, [[size * 0.5, -size * 0.5], [size * 0.27, -size * 0.64], [size * 0.31, -size * 0.5], [size * 0.27, -size * 0.36]]);
  ctx.fill();
}

function drawMortarTower(ctx, size, palette) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.07, 1.3, 2.3);
  ctx.fillStyle = palette.main;
  roundedRect(ctx, -size * 0.34, -size * 0.22, size * 0.68, size * 0.4, size * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.rotate(-0.62);
  ctx.fillStyle = palette.light;
  roundedRect(ctx, -size * 0.13, -size * 0.66, size * 0.27, size * 0.72, size * 0.11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  roundedRect(ctx, -size * 0.17, -size * 0.71, size * 0.34, size * 0.18, size * 0.07);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = palette.accent;
  circle(ctx, 0, -size * 0.02, size * 0.09);
  ctx.fill();
}

function drawPyreTower(ctx, size, palette, time) {
  ctx.fillStyle = palette.main;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.065, 1.3, 2.2);
  ctx.beginPath();
  ctx.moveTo(-size * 0.36, -size * 0.12);
  ctx.quadraticCurveTo(0, size * 0.12, size * 0.36, -size * 0.12);
  ctx.lineTo(size * 0.27, size * 0.15);
  ctx.quadraticCurveTo(0, size * 0.31, -size * 0.27, size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.12, size * 0.34, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  const sway = Math.sin(time * 3.1) * size * 0.025;
  drawFlame(ctx, sway, -size * 0.5, size * 0.39, COLORS.ember);
  drawFlame(ctx, -sway * 0.5, -size * 0.44, size * 0.23, COLORS.emberPale);
}

function drawSnowflake(ctx, x, y, radius, color = COLORS.paperLight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = clamp(radius * 0.13, 1, 1.7);
  ctx.lineCap = "round";
  for (let index = 0; index < 3; index += 1) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrostTower(ctx, size, palette) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.065, 1.3, 2.2);
  ctx.fillStyle = palette.main;
  ctx.beginPath();
  ctx.moveTo(-size * 0.36, size * 0.06);
  ctx.quadraticCurveTo(-size * 0.25, -size * 0.51, 0, -size * 0.58);
  ctx.quadraticCurveTo(size * 0.25, -size * 0.51, size * 0.36, size * 0.06);
  ctx.quadraticCurveTo(0, size * 0.25, -size * 0.36, size * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  circle(ctx, 0, size * 0.11, size * 0.09);
  ctx.fill();
  ctx.stroke();
  drawSnowflake(ctx, 0, -size * 0.23, size * 0.19);
}

function drawArcTower(ctx, size, palette, time) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.065, 1.3, 2.2);
  ctx.fillStyle = palette.main;
  polygon(ctx, [[-size * 0.28, size * 0.17], [-size * 0.12, -size * 0.46], [0, -size * 0.2], [size * 0.12, -size * 0.46], [size * 0.28, size * 0.17]]);
  ctx.fill();
  ctx.stroke();
  const pulse = 0.5 + 0.5 * Math.sin(time * 4.3);
  setShadow(ctx, `rgba(255,209,132,${0.25 + pulse * 0.18})`, size * 0.32);
  ctx.fillStyle = COLORS.emberPale;
  polygon(ctx, [[size * 0.05, -size * 0.69], [-size * 0.18, -size * 0.33], [size * 0.02, -size * 0.35], [-size * 0.08, -size * 0.04], [size * 0.25, -size * 0.47], [size * 0.04, -size * 0.44]]);
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}

function drawLevelPips(ctx, tower, size) {
  const count = clamp(Math.round(positiveNumber(tower.level, 1)), 1, 6);
  const spacing = clamp(size * 0.18, 3.5, 5.5);
  const start = -(count - 1) * spacing / 2;
  for (let index = 0; index < count; index += 1) {
    ctx.fillStyle = index === count - 1 ? COLORS.gold : COLORS.paperLight;
    ctx.strokeStyle = "rgba(36,33,24,0.64)";
    ctx.lineWidth = 0.9;
    circle(ctx, start + index * spacing, size * 0.69, clamp(size * 0.07, 1.7, 2.5));
    ctx.fill();
    ctx.stroke();
  }
}

function drawTower(ctx, tower, layout, options, time, ghost = false) {
  const size = clamp(layout.unit * 0.55, 15, 25);
  const palette = towerPalette(tower.kind);
  ctx.save();
  ctx.translate(tower.cx, tower.cy);
  if (ghost) ctx.globalAlpha = 0.72;
  if (tower.id === normalizeId(options.selectedTowerId)) {
    ctx.fillStyle = "rgba(255,250,240,0.38)";
    ctx.strokeStyle = COLORS.ember;
    ctx.lineWidth = 2;
    circle(ctx, 0, 0, clamp(size * 1.22, 23, 31));
    ctx.fill();
    ctx.stroke();
  }
  drawTowerPedestal(ctx, size, palette);
  if (tower.kind === "mortar") drawMortarTower(ctx, size, palette);
  else if (tower.kind === "pyre") drawPyreTower(ctx, size, palette, time);
  else if (tower.kind === "frost") drawFrostTower(ctx, size, palette);
  else if (tower.kind === "arc") drawArcTower(ctx, size, palette, time);
  else drawSentinelTower(ctx, size, palette);
  if (!ghost) drawLevelPips(ctx, tower, size);
  ctx.restore();
}

function drawTowers(ctx, layout, options, time) {
  const preview = resolveRangePreview(layout, options);
  if (preview && options.selectedTowerType && !options.selectedTowerId) {
    drawTower(ctx, { id: "preview", kind: towerKind(options.selectedTowerType), cx: preview.cx, cy: preview.cy, level: 1 }, layout, {}, time, true);
  }
  const ordered = [...layout.towers].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  for (const tower of ordered) drawTower(ctx, tower, layout, options, time);
}

function mobPalette(kind) {
  switch (kind) {
    case "mite": return { main: "#a75d43", light: COLORS.emberPale, detail: COLORS.oxblood };
    case "brute": return { main: "#7c5e4e", light: "#b99d82", detail: COLORS.ink };
    case "ironbound": return { main: "#65716c", light: "#aeb8ad", detail: COLORS.gold };
    case "wisp": return { main: COLORS.violet, light: "#cfc1d8", detail: COLORS.paperLight };
    case "hulk": return { main: "#6d6255", light: "#a89b84", detail: COLORS.ember };
    case "boss": return { main: COLORS.oxblood, light: "#b46b55", detail: COLORS.emberPale };
    default: return { main: "#826451", light: "#c6a887", detail: COLORS.emberPale };
  }
}

function drawAshling(ctx, size, palette) {
  ctx.fillStyle = palette.main;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.08, 1.2, 2.2);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.72);
  ctx.quadraticCurveTo(size * 0.52, -size * 0.28, size * 0.42, size * 0.48);
  ctx.quadraticCurveTo(0, size * 0.72, -size * 0.42, size * 0.48);
  ctx.quadraticCurveTo(-size * 0.52, -size * 0.28, 0, -size * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.light;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.2, size * 0.25, size * 0.21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  circle(ctx, -size * 0.08, -size * 0.2, size * 0.035);
  ctx.fill();
  circle(ctx, size * 0.08, -size * 0.2, size * 0.035);
  ctx.fill();
}

function drawMite(ctx, size, palette) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.1, 1.2, 2.1);
  ctx.lineCap = "round";
  for (let side = -1; side <= 1; side += 2) {
    for (let index = -1; index <= 1; index += 1) {
      const y = index * size * 0.2;
      ctx.beginPath();
      ctx.moveTo(side * size * 0.26, y);
      ctx.lineTo(side * size * 0.67, y + index * size * 0.14);
      ctx.stroke();
    }
  }
  ctx.fillStyle = palette.main;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.light;
  polygon(ctx, [[0, -size * 0.48], [size * 0.18, -size * 0.12], [0, size * 0.16], [-size * 0.18, -size * 0.12]]);
  ctx.fill();
}

function drawBrute(ctx, size, palette) {
  ctx.fillStyle = palette.main;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.075, 1.3, 2.4);
  ctx.beginPath();
  ctx.moveTo(-size * 0.66, size * 0.44);
  ctx.quadraticCurveTo(-size * 0.68, -size * 0.22, -size * 0.36, -size * 0.38);
  ctx.lineTo(-size * 0.22, -size * 0.66);
  ctx.lineTo(size * 0.22, -size * 0.66);
  ctx.lineTo(size * 0.36, -size * 0.38);
  ctx.quadraticCurveTo(size * 0.68, -size * 0.22, size * 0.66, size * 0.44);
  ctx.quadraticCurveTo(0, size * 0.72, -size * 0.66, size * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.light;
  roundedRect(ctx, -size * 0.25, -size * 0.42, size * 0.5, size * 0.42, size * 0.16);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(-size * 0.16, -size * 0.2);
  ctx.lineTo(size * 0.16, -size * 0.2);
  ctx.stroke();
}

function drawIronbound(ctx, size, palette) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.075, 1.3, 2.4);
  ctx.fillStyle = palette.main;
  polygon(ctx, [[0, -size * 0.72], [size * 0.56, -size * 0.42], [size * 0.48, size * 0.34], [0, size * 0.7], [-size * 0.48, size * 0.34], [-size * 0.56, -size * 0.42]]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.light;
  polygon(ctx, [[0, -size * 0.52], [size * 0.33, -size * 0.29], [size * 0.27, size * 0.22], [0, size * 0.46], [-size * 0.27, size * 0.22], [-size * 0.33, -size * 0.29]]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.detail;
  roundedRect(ctx, -size * 0.24, -size * 0.25, size * 0.48, size * 0.11, size * 0.04);
  ctx.fill();
}

function drawWisp(ctx, size, palette, time) {
  const sway = Math.sin(time * 2.7) * size * 0.05;
  setShadow(ctx, "rgba(129,112,145,0.32)", size * 0.5);
  ctx.fillStyle = palette.main;
  ctx.beginPath();
  ctx.moveTo(sway, -size * 0.77);
  ctx.bezierCurveTo(size * 0.42, -size * 0.37, size * 0.55, size * 0.1, size * 0.26, size * 0.54);
  ctx.quadraticCurveTo(size * 0.08, size * 0.27, 0, size * 0.72);
  ctx.quadraticCurveTo(-size * 0.16, size * 0.3, -size * 0.34, size * 0.54);
  ctx.bezierCurveTo(-size * 0.58, size * 0.08, -size * 0.43, -size * 0.36, sway, -size * 0.77);
  ctx.closePath();
  ctx.fill();
  clearShadow(ctx);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.065, 1.1, 2);
  ctx.stroke();
  ctx.fillStyle = palette.light;
  circle(ctx, 0, -size * 0.08, size * 0.23);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  circle(ctx, -size * 0.075, -size * 0.08, size * 0.028);
  ctx.fill();
  circle(ctx, size * 0.075, -size * 0.08, size * 0.028);
  ctx.fill();
}

function drawHulk(ctx, size, palette, boss = false) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = clamp(size * 0.075, 1.4, 2.7);
  ctx.fillStyle = palette.main;
  polygon(ctx, [[-size * 0.68, size * 0.55], [-size * 0.62, -size * 0.28], [-size * 0.36, -size * 0.62], [size * 0.36, -size * 0.62], [size * 0.62, -size * 0.28], [size * 0.68, size * 0.55]]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = palette.light;
  roundedRect(ctx, -size * 0.31, -size * 0.47, size * 0.62, size * 0.48, size * 0.13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  roundedRect(ctx, -size * 0.23, -size * 0.28, size * 0.46, size * 0.1, size * 0.03);
  ctx.fill();
  if (boss) {
    ctx.fillStyle = palette.detail;
    polygon(ctx, [[-size * 0.56, -size * 0.5], [-size * 0.83, -size * 0.82], [-size * 0.36, -size * 0.64]]);
    ctx.fill();
    ctx.stroke();
    polygon(ctx, [[size * 0.56, -size * 0.5], [size * 0.83, -size * 0.82], [size * 0.36, -size * 0.64]]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.ember;
    polygon(ctx, [[0, size * 0.03], [size * 0.17, size * 0.28], [0, size * 0.48], [-size * 0.17, size * 0.28]]);
    ctx.fill();
  } else {
    ctx.fillStyle = palette.detail;
    circle(ctx, 0, size * 0.22, size * 0.11);
    ctx.fill();
  }
}

function effectState(mob) {
  const effects = mob?.effects;
  if (Array.isArray(effects)) {
    const names = effects.map((effect) => normalizeId(effect?.type ?? effect).toLowerCase());
    return {
      burning: names.some((name) => name.includes("burn") || name.includes("dot") || name.includes("fire") || name.includes("poison")),
      slowed: names.some((name) => name.includes("slow") || name.includes("frost") || name.includes("freeze")),
    };
  }
  return {
    burning: Boolean(effects?.burn || effects?.dot || effects?.poison || (Array.isArray(effects?.dots) && effects.dots.length)),
    slowed: Boolean(effects?.slow || effects?.frost || effects?.freeze),
  };
}

function drawMobStatuses(ctx, mob, time) {
  const state = effectState(mob);
  const size = mob.scale;
  if (state.slowed) {
    ctx.save();
    ctx.strokeStyle = "rgba(104,136,151,0.78)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(0, size * 0.28, size * 0.78, size * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawSnowflake(ctx, size * 0.5, -size * 0.45, clamp(size * 0.18, 2.8, 5.2), COLORS.blueLight);
    ctx.restore();
  }
  if (state.burning) {
    const bob = Math.sin(time * 4 + finiteNumber(mob.gridX)) * size * 0.04;
    drawFlame(ctx, -size * 0.52, -size * 0.38 + bob, clamp(size * 0.23, 3.2, 6.2), COLORS.emberHot);
    ctx.fillStyle = COLORS.emberPale;
    circle(ctx, size * 0.47, -size * 0.08 - bob, clamp(size * 0.065, 1.2, 2.2));
    ctx.fill();
  }
}

function drawBossCrown(ctx, mob) {
  const size = mob.scale;
  ctx.save();
  ctx.translate(0, -size * 1.13);
  setShadow(ctx, "rgba(196,156,75,0.26)", 4, 1);
  ctx.fillStyle = COLORS.emberPale;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  polygon(ctx, [[-size * 0.4, size * 0.22], [-size * 0.36, -size * 0.24], [-size * 0.12, 0], [0, -size * 0.34], [size * 0.12, 0], [size * 0.36, -size * 0.24], [size * 0.4, size * 0.22]]);
  ctx.fill();
  clearShadow(ctx);
  ctx.stroke();
  ctx.restore();
}

function drawBar(ctx, x, y, width, height, ratio, fill, background = COLORS.paperDeep) {
  roundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.strokeStyle = "rgba(36,33,24,0.72)";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  const inner = 1;
  const fillWidth = Math.max(0, (width - inner * 2) * clamp(ratio, 0, 1));
  if (fillWidth > 0.1) {
    roundedRect(ctx, x + inner, y + inner, fillWidth, Math.max(0.5, height - inner * 2), Math.max(0, height / 2 - inner));
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function drawMobBars(ctx, mob) {
  const size = mob.scale;
  const width = clamp(size * (mob.isBoss ? 2.25 : 1.65), mob.isBoss ? 42 : 23, mob.isBoss ? 64 : 36);
  const height = mob.isBoss ? 6 : 4.5;
  const maxHp = Math.max(1, positiveNumber(mob.maxHp ?? mob.maxHealth, positiveNumber(mob.hp ?? mob.health, 1)));
  const hp = clamp(finiteNumber(mob.hp ?? mob.health, maxHp), 0, maxHp);
  const maxShield = Math.max(0, finiteNumber(mob.maxShield, finiteNumber(mob.shield, 0)));
  const shield = clamp(finiteNumber(mob.shield, maxShield), 0, Math.max(1, maxShield));
  const barY = -size * (mob.isBoss ? 1.36 : 1.08);
  drawBar(ctx, -width / 2, barY, width, height, hp / maxHp, hp / maxHp < 0.3 ? COLORS.danger : COLORS.health);
  if (maxShield > 0 || shield > 0) drawBar(ctx, -width / 2, barY - height - 2, width, Math.max(3.5, height - 1), maxShield > 0 ? shield / maxShield : 1, COLORS.shield, "rgba(238,229,210,0.84)");
}

function drawMob(ctx, mob, time) {
  const size = mob.scale;
  const palette = mobPalette(mob.kind);
  ctx.save();
  ctx.translate(mob.cx, mob.cy);
  drawMobStatuses(ctx, mob, time);
  ctx.fillStyle = "rgba(36,33,24,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.56, size * 0.66, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  setShadow(ctx, "rgba(36,33,24,0.14)", 3, 2);
  if (mob.kind === "mite") drawMite(ctx, size, palette);
  else if (mob.kind === "brute") drawBrute(ctx, size, palette);
  else if (mob.kind === "ironbound") drawIronbound(ctx, size, palette);
  else if (mob.kind === "wisp") drawWisp(ctx, size, palette, time);
  else if (mob.kind === "hulk") drawHulk(ctx, size, palette, false);
  else if (mob.kind === "boss") drawHulk(ctx, size, palette, true);
  else drawAshling(ctx, size, palette);
  clearShadow(ctx);
  const shield = Math.max(0, finiteNumber(mob.shield));
  if (shield > 0) {
    ctx.strokeStyle = "rgba(113,155,173,0.72)";
    ctx.lineWidth = clamp(size * 0.1, 1.5, 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.86, size * 0.93, 0, -Math.PI * 0.88, Math.PI * 0.88);
    ctx.stroke();
  }
  if (mob.isBoss) drawBossCrown(ctx, mob);
  drawMobBars(ctx, mob);
  ctx.restore();
}

function drawMobs(ctx, layout, time) {
  const ordered = [...layout.mobs].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  for (const mob of ordered) drawMob(ctx, mob, time);
}

function normalizedEffects(run, options) {
  const source = options.effects ?? run?.effects ?? run?.visualEffects;
  const effects = [];
  if (Array.isArray(source)) effects.push(...source);
  else if (source && typeof source === "object") {
    for (const [group, items] of Object.entries(source)) {
      if (Array.isArray(items)) effects.push(...items.map((effect) => ({ ...effect, type: effect?.type || group.replace(/s$/, "") })));
    }
  }
  for (const [group, items] of [["projectile", options.projectiles], ["impact", options.impacts]]) {
    if (Array.isArray(items)) effects.push(...items.map((effect) => ({ ...effect, type: effect?.type || group })));
  }
  return effects.filter(Boolean);
}

function entityPoint(layout, id) {
  const normalized = normalizeId(id);
  if (!normalized) return null;
  return layout.towers.find((tower) => tower.id === normalized)
    || layout.mobs.find((mob) => mob.id === normalized)
    || layout.pads.find((pad) => pad.id === normalized)
    || null;
}

function explicitEffectPoint(layout, value) {
  if (!value || typeof value !== "object") return null;
  if (Number.isFinite(Number(value.cx)) && Number.isFinite(Number(value.cy))) return { x: Number(value.cx), y: Number(value.cy) };
  if (!Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
  if (value.coordinateSpace === "canvas" || value.space === "canvas" || value.pixel === true) return { x: Number(value.x), y: Number(value.y) };
  return gridPoint(layout, Number(value.x), Number(value.y));
}

function effectEndpoints(layout, effect) {
  const sourceId = effect.sourceTowerId ?? effect.towerId ?? effect.sourceId ?? effect.fromId;
  const targetId = effect.mobId ?? effect.targetId ?? effect.toId ?? effect.targetIds?.[0];
  const sourceEntity = entityPoint(layout, sourceId);
  const targetEntity = entityPoint(layout, targetId);
  const from = explicitEffectPoint(layout, effect.from ?? effect.source) || (sourceEntity ? { x: sourceEntity.cx, y: sourceEntity.cy } : null);
  const to = explicitEffectPoint(layout, effect.to ?? effect.target ?? effect.position) || (targetEntity ? { x: targetEntity.cx, y: targetEntity.cy } : null);
  return { from, to, sourceEntity, targetEntity };
}

function visualEffectProgress(effect, time) {
  const direct = effect.progress ?? effect.t ?? effect.portion;
  if (Number.isFinite(Number(direct))) return clamp(Number(direct), 0, 1);
  const startedAt = effect.startedAt ?? effect.startTime ?? effect.createdAt;
  if (Number.isFinite(Number(startedAt))) {
    const start = Number(startedAt) > 10000 ? Number(startedAt) / 1000 : Number(startedAt);
    const duration = positiveNumber(effect.duration, 0.35);
    return clamp((time - start) / duration, 0, 1);
  }
  const age = effect.age ?? effect.elapsed;
  if (Number.isFinite(Number(age))) return clamp(Number(age) / positiveNumber(effect.duration, 0.35), 0, 1);
  return 0.62;
}

function projectileColor(kind) {
  if (kind === "frost") return COLORS.blueLight;
  if (kind === "arc") return COLORS.emberPale;
  if (kind === "mortar" || kind === "pyre") return COLORS.emberHot;
  return COLORS.paperLight;
}

function drawProjectileEffect(ctx, layout, effect, endpoints, time) {
  if (!endpoints.from || !endpoints.to) return;
  const progress = visualEffectProgress(effect, time);
  const kind = towerKind(effect.typeId ?? effect.towerType ?? endpoints.sourceEntity?.towerType ?? endpoints.sourceEntity?.kind);
  const color = projectileColor(kind);
  const dx = endpoints.to.x - endpoints.from.x;
  const dy = endpoints.to.y - endpoints.from.y;
  const arc = kind === "mortar" ? -Math.max(18, Math.hypot(dx, dy) * 0.22) : -Math.min(8, Math.hypot(dx, dy) * 0.04);
  const pointAt = (portion) => ({
    x: mix(endpoints.from.x, endpoints.to.x, portion),
    y: mix(endpoints.from.y, endpoints.to.y, portion) + Math.sin(portion * Math.PI) * arc,
  });
  const point = pointAt(progress);
  const tail = pointAt(Math.max(0, progress - 0.16));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = kind === "mortar" ? 2.4 : 1.6;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  setShadow(ctx, color, kind === "mortar" ? 7 : 4);
  ctx.fillStyle = color;
  if (kind === "sentinel") {
    const angle = Math.atan2(point.y - tail.y, point.x - tail.x);
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    polygon(ctx, [[5, 0], [-3, -2.2], [-1, 0], [-3, 2.2]]);
    ctx.fill();
  } else {
    circle(ctx, point.x, point.y, kind === "mortar" ? 4.3 : 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawImpactEffect(ctx, layout, effect, endpoints, time, kindOverride = "") {
  const point = endpoints.to || endpoints.from;
  if (!point) return;
  const progress = visualEffectProgress(effect, time);
  const kind = kindOverride || towerKind(effect.typeId ?? effect.towerType ?? endpoints.sourceEntity?.towerType);
  const color = kind === "frost" ? COLORS.blue : kind === "arc" ? COLORS.gold : kind === "sentinel" ? COLORS.paperLight : COLORS.ember;
  const effectRadius = positiveNumber(effect.radius, kind === "mortar" ? 1.1 : 0.48) * layout.unit;
  const radius = mix(effectRadius * 0.18, effectRadius, progress);
  ctx.save();
  ctx.globalAlpha = 1 - progress * 0.82;
  ctx.strokeStyle = color;
  ctx.lineWidth = mix(3, 1, progress);
  circle(ctx, point.x, point.y, radius);
  ctx.stroke();
  ctx.fillStyle = kind === "frost" ? "rgba(185,213,220,0.2)" : "rgba(255,146,81,0.16)";
  circle(ctx, point.x, point.y, radius * 0.72);
  ctx.fill();
  if (kind === "frost") {
    for (let index = 0; index < 4; index += 1) {
      const angle = Math.PI * 2 * index / 4 + progress;
      drawSnowflake(ctx, point.x + Math.cos(angle) * radius * 0.65, point.y + Math.sin(angle) * radius * 0.42, clamp(layout.unit * 0.11, 2.5, 5), COLORS.blue);
    }
  } else if (kind === "mortar" || kind === "pyre") {
    for (let index = 0; index < 5; index += 1) {
      const angle = Math.PI * 2 * index / 5 - Math.PI / 2;
      const distance = radius * (0.35 + index % 2 * 0.22);
      ctx.fillStyle = index % 2 ? COLORS.emberPale : COLORS.emberHot;
      circle(ctx, point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, Math.max(1, 2.4 * (1 - progress)));
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLightning(ctx, from, to, progress, color = COLORS.emberPale) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  ctx.save();
  setShadow(ctx, color, 5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (let index = 1; index < 6; index += 1) {
    const portion = index / 6;
    const offset = (index % 2 ? 1 : -1) * Math.min(6, length * 0.045) * (1 - progress * 0.35);
    ctx.lineTo(from.x + dx * portion + normalX * offset, from.y + dy * portion + normalY * offset);
  }
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  clearShadow(ctx);
  ctx.strokeStyle = "rgba(255,250,240,0.82)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

function drawFloatingAmount(ctx, layout, effect, point, progress) {
  const amount = effect.amount ?? effect.damage;
  if (!Number.isFinite(Number(amount)) || !point) return;
  ctx.save();
  ctx.globalAlpha = 1 - progress * 0.7;
  ctx.fillStyle = effect.kind === "heal" ? COLORS.health : COLORS.oxblood;
  ctx.strokeStyle = "rgba(255,250,240,0.9)";
  ctx.lineWidth = 2.5;
  ctx.font = `800 ${clamp(layout.unit * 0.32, 10, 15)}px "DM Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = `${effect.kind === "heal" ? "+" : "−"}${Math.abs(Number(amount))}`;
  const y = point.y - layout.unit * (0.55 + progress * 0.65);
  ctx.strokeText(text, point.x, y);
  ctx.fillText(text, point.x, y);
  ctx.restore();
}

function drawEffects(ctx, layout, run, options, time) {
  const effects = normalizedEffects(run, options);
  effects.forEach((effect, index) => {
    const type = normalizeId(effect.type ?? effect.kind).toLowerCase();
    const endpoints = effectEndpoints(layout, effect);
    const progress = visualEffectProgress(effect, time);
    if (type.includes("chain") || type.includes("arc") || type.includes("lightning")) {
      if (Array.isArray(effect.points) && effect.points.length > 1) {
        const points = effect.points.map((point) => explicitEffectPoint(layout, point)).filter(Boolean);
        points.slice(1).forEach((point, pointIndex) => drawLightning(ctx, points[pointIndex], point, progress));
      } else if (endpoints.from && endpoints.to) drawLightning(ctx, endpoints.from, endpoints.to, progress);
    } else if (type.includes("projectile") || type.includes("shot") || type === "tower-fired" || type === "fire") {
      drawProjectileEffect(ctx, layout, effect, endpoints, time);
    } else if (type.includes("impact") || type.includes("aoe") || type.includes("explosion") || type.includes("hit")) {
      drawImpactEffect(ctx, layout, effect, endpoints, time);
    } else if (type.includes("slow") || type.includes("frost") || type.includes("freeze")) {
      drawImpactEffect(ctx, layout, { ...effect, radius: effect.radius ?? 0.65 }, endpoints, time, "frost");
    } else if (type.includes("burn") || type.includes("dot") || type.includes("brand")) {
      const point = endpoints.to || endpoints.from;
      if (point) drawFlame(ctx, point.x, point.y - layout.unit * 0.35, clamp(layout.unit * 0.24, 4, 8), COLORS.emberHot);
    } else if (type.includes("leak") || type.includes("base")) {
      drawImpactEffect(ctx, layout, { ...effect, radius: effect.radius ?? 0.85 }, { from: { x: layout.base.cx, y: layout.base.cy }, to: { x: layout.base.cx, y: layout.base.cy } }, time, "pyre");
    }
    if (type.includes("damage") || Number.isFinite(Number(effect.amount ?? effect.damage))) {
      drawFloatingAmount(ctx, layout, effect, endpoints.to || endpoints.from, progress + index * 0.015);
    }
  });
}

function drawFrame(ctx, layout) {
  const gradient = ctx.createLinearGradient(0, 0, 0, layout.height);
  gradient.addColorStop(0, "rgba(255,250,240,0.13)");
  gradient.addColorStop(0.12, "rgba(255,255,255,0)");
  gradient.addColorStop(0.84, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(36,33,24,0.09)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.strokeStyle = "rgba(255,250,240,0.25)";
  ctx.lineWidth = 1;
  roundedRect(ctx, 8.5, 8.5, Math.max(0, layout.width - 17), Math.max(0, layout.height - 17), 15);
  ctx.stroke();
}

function normalizedTime(value, reducedMotion) {
  if (reducedMotion) return 0;
  let time = Number(value);
  if (!Number.isFinite(time)) {
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    time = now / 1000;
  } else if (Math.abs(time) > 10000) {
    time /= 1000;
  }
  return time;
}

/**
 * Paint the current run into a portrait battlefield canvas.
 *
 * The returned layout is expressed in CSS pixels and is intentionally useful
 * to callers and tests: pads, towers, mobs, path points, hit radii, and grid
 * metrics are all included. The renderer never mutates the run state.
 */
export function drawBattlefield(canvas, run, options = {}) {
  const layout = buildLayout(canvas, run, options);
  if (!canvas || typeof canvas.getContext !== "function") return layout;

  const pixelWidth = Math.max(1, Math.round(layout.width * layout.dpr));
  const pixelHeight = Math.max(1, Math.round(layout.height * layout.dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return layout;

  if (typeof ctx.setTransform === "function") ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  else if (typeof ctx.scale === "function") ctx.scale(layout.dpr, layout.dpr);
  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const time = normalizedTime(options.time, options.reducedMotion);

  drawField(ctx, layout);
  drawDecor(ctx, layout);
  drawPath(ctx, layout);
  drawPortal(ctx, layout.portal, time);
  drawBase(ctx, layout.base, time);
  drawPads(ctx, layout, options, time);
  drawRange(ctx, layout, options);
  drawTowers(ctx, layout, options, time);
  drawMobs(ctx, layout, time);
  drawEffects(ctx, layout, run, options, time);
  drawFrame(ctx, layout);
  ctx.restore();

  return layout;
}

function nearestWithin(items, x, y) {
  let nearest = null;
  for (const item of items) {
    const distance = Math.hypot(x - item.cx, y - item.cy);
    if (distance > item.hitRadius) continue;
    if (!nearest || distance < nearest.distance) nearest = { item, distance };
  }
  return nearest;
}

/**
 * Hit-test pointer coordinates expressed in browser client pixels.
 * Towers win over their underlying pads; otherwise the closest target wins.
 */
export function hitTestBattlefield(canvas, run, clientX, clientY) {
  if (!canvas || !Number.isFinite(Number(clientX)) || !Number.isFinite(Number(clientY))) return null;
  const layout = buildLayout(canvas, run);
  let rect = layout.rect;
  if (!rect) {
    try {
      rect = canvas.getBoundingClientRect?.() || null;
    } catch {
      rect = null;
    }
  }
  const rectWidth = positiveNumber(rect?.width, layout.width);
  const rectHeight = positiveNumber(rect?.height, layout.height);
  const localX = (Number(clientX) - finiteNumber(rect?.left)) * layout.width / rectWidth;
  const localY = (Number(clientY) - finiteNumber(rect?.top)) * layout.height / rectHeight;

  const towerHit = nearestWithin(layout.towers, localX, localY);
  if (towerHit) {
    const tower = towerHit.item;
    return {
      kind: "tower",
      type: "tower",
      id: tower.id,
      towerId: tower.id,
      padId: tower.padId || null,
      towerType: tower.towerType,
      x: tower.gridX,
      y: tower.gridY,
      clientX: Number(clientX),
      clientY: Number(clientY),
      canvasX: localX,
      canvasY: localY,
      distance: towerHit.distance,
      tower,
    };
  }

  const padHit = nearestWithin(layout.pads.filter((pad) => !pad.occupied), localX, localY);
  if (padHit) {
    const pad = padHit.item;
    return {
      kind: "pad",
      type: "pad",
      id: pad.id,
      padId: pad.id,
      x: pad.x,
      y: pad.y,
      occupied: pad.occupied,
      clientX: Number(clientX),
      clientY: Number(clientY),
      canvasX: localX,
      canvasY: localY,
      distance: padHit.distance,
      pad,
    };
  }

  return null;
}
