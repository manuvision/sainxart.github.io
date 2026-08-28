const ICONS = {
  ward: `<path d="M12 2 20 6v6c0 5-3.2 8-8 10-4.8-2-8-5-8-10V6l8-4Z"/><path d="M12 6v12M8 11h8"/>`,
  flame: `<path d="M13 2c1 5 6 7 6 13a7 7 0 0 1-14 0c0-4 2-8 7-11-1 5 4 6 2 11 4-3 2-8-1-13Z"/><path d="M10 20c-3-2-3-6 1-9-1 4 4 5 1 9"/>`,
  coin: `<circle cx="12" cy="12" r="9"/><path d="M9 8h5.5a2.5 2.5 0 0 1 0 5H10a2.5 2.5 0 0 0 0 5h5M12 5v14"/>`,
  cinder: `<path d="m12 2 2.2 6.5L21 10l-5.5 4 1.7 7-5.2-4-5.2 4 1.7-7L3 10l6.8-1.5L12 2Z"/>`,
  sigil: `<path d="M12 2 20 7l-2 10-6 5-6-5L4 7l8-5Z"/><path d="m12 6 3 5-3 6-3-6 3-5Z"/>`,
  play: `<path d="m8 5 11 7-11 7V5Z"/>`,
  pause: `<path d="M8 5v14M16 5v14"/>`,
  speed: `<path d="m4 6 8 6-8 6V6Zm8 0 8 6-8 6V6Z"/>`,
  sound: `<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>`,
  mute: `<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.8 2h-3L7 4.3l-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.8 2.3h3l.7-2.3 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2-.7Z" transform="translate(1.2) scale(.9)"/>`,
  close: `<path d="m6 6 12 12M18 6 6 18"/>`,
  arrow: `<path d="M4 19 19 4M11 4h8v8"/><path d="M4 13v7h7"/>`,
  back: `<path d="M20 12H5M11 6l-6 6 6 6"/>`,
  mortar: `<path d="M6 18 17 7l3 3-11 11H5v-4Z"/><path d="m14 6 2-3 5 5-3 2M3 21h10"/>`,
  pyre: `<path d="M5 20h14M7 20l1-8h8l1 8M9 12V8h6v4"/><path d="M12 2c1 3 4 4 3 7-1 2-2 3-4 3 1-2-2-3 1-6-1 2 2 2 0-4Z"/>`,
  frost: `<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M8 4l4 3 4-3M8 20l4-3 4 3M4 11l4-1-1-4M20 13l-4 1 1 4"/>`,
  arc: `<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>`,
  heart: `<path d="M12 21S3 16 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12Z"/>`,
  sword: `<path d="m6 19 4-4 8-8 1-4-4 1-8 8 3 3-4 4Z"/><path d="m14 5 5 5"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>`,
  branch: `<path d="M5 20c7-3 7-9 7-16M9 15c4-1 7-4 9-8M11 10 7 6"/><circle cx="7" cy="5" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="20" r="2"/>`,
  skull: `<path d="M5 11a7 7 0 1 1 14 0c0 3-1 4-3 5v4H8v-4c-2-1-3-2-3-5Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="M10 16v4M14 16v4"/>`,
  forge: `<path d="M4 20h16M6 20l2-8h8l2 8M9 12c0-4 1-6 4-9 4 4 4 7 3 9"/><path d="M7 12h11"/>`,
  map: `<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Z"/><path d="M9 2v17M15 5v17"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>`,
  focus: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`,
  spark: `<path d="m12 2 2.2 6.5L21 10l-5.5 4 1.7 7-5.2-4-5.2 4 1.7-7L3 10l6.8-1.5L12 2Z"/>`,
};

export function icon(name, className = "") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.flame}</svg>`;
}

export function flameSigil(className = "") {
  return `<svg class="${className}" viewBox="0 0 48 60" aria-hidden="true"><path d="M25 2c2 12 15 17 15 33 0 10-7 19-18 24 5-9-1-15-7-21-5-6-6-14 9-24-2 10 8 15 10 24C42 19 21 16 25 2Z"/><path d="M22 56c-7-5-10-11-8-17 1-5 5-8 10-12-3 9 6 13 3 22 6-5 4-10 2-15 8 9 5 17-7 22Z" fill="var(--ember-pale)"/></svg>`;
}

export const TOWER_ICON = {
  sentinel: "arrow",
  mortar: "mortar",
  pyre: "pyre",
  frost: "frost",
  arc: "arc",
  ashbolt: "arrow",
  cinder_mortar: "mortar",
  brand_brazier: "pyre",
  rime_bell: "frost",
  storm_reliquary: "arc",
};

export function towerIcon(type, className = "") {
  return icon(TOWER_ICON[type] || "ward", className);
}

export function towerSeal(type) {
  const iconName = TOWER_ICON[type] || "ward";
  return `<span class="tower-seal tower-seal--${type}">${icon(iconName)}</span>`;
}
