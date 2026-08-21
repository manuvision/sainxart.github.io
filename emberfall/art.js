const ICONS = {
  blade: `<path d="m6 19 4-4m0 0 8-8 1-4-4 1-8 8 3 3Zm-5 4 3-3m-1-2 3 3"/><path d="m14 5 5 5"/>`,
  shield: `<path d="M12 3 20 7v5c0 5.2-3.3 8-8 10-4.7-2-8-4.8-8-10V7l8-4Z"/><path d="M12 7v11M8 11h8"/>`,
  forward: `<path d="M4 12h14M13 6l6 6-6 6"/><path d="M5 6v12"/>`,
  back: `<path d="M20 12H6M11 6l-6 6 6 6"/><path d="M19 6v12"/>`,
  focus: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`,
  gem: `<path d="m12 3 6 4 2 6-8 8-8-8 2-6 6-4Z"/><path d="m6 7 6 14 6-14M4 13h16M6 7h12"/>`,
  bolt: `<path d="M13 2 5 13h6l-1 9 9-13h-6V2Z"/>`,
  missile: `<path d="M5 18 18 5M9 5h9v9"/><path d="M4 9h3M4 14h6M10 20v-3"/>`,
  spark: `<path d="m12 2 2.2 6.5L21 10l-5.5 4 1.7 7-5.2-4-5.2 4 1.7-7L3 10l6.8-1.5L12 2Z"/>`,
  ward: `<circle cx="12" cy="12" r="9"/><path d="m12 5 4 5-4 8-4-8 4-5Z"/><path d="m5 8 4 2M19 8l-4 2"/>`,
  step: `<path d="M7 15c-2 1-3 3-1 5 2 2 6 0 7-2 1-2-2-4-3-7L8 5c-1-2-4-1-4 1 0 3 2 6 3 9Z"/><path d="M16 11c-1 2-3 4-2 6 1 2 4 2 5 0 1-2 0-4 0-6V6c0-2-3-3-4-1-1 2 0 4 1 6Z"/>`,
  fireball: `<circle cx="14" cy="10" r="6"/><path d="M9 14 3 20M8 10l-5 3M12 16l-2 5"/><path d="M14 6c0 3 3 3 2 6"/>`,
  brand: `<path d="M12 2c1 5 6 7 6 13a6 6 0 0 1-12 0c0-4 2-7 6-10-1 4 3 5 2 9 3-3 0-7-2-12Z"/><path d="M10 19c-2-2-2-4 1-6-1 3 3 3 1 6"/>`,
  wall: `<path d="M4 21V9M10 21V5M16 21V8M22 21V3"/><path d="M2 21h22"/><path d="M4 9c4-2 3-5 2-7 4 3 5 5 4 8M16 8c3-2 3-4 2-6 4 3 4 6 4 9"/>`,
};

export function icon(name, className = "") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.spark}</svg>`;
}

export function flameSigil(className = "") {
  return `<svg class="${className}" viewBox="0 0 48 60" aria-hidden="true"><path d="M25 2c2 12 15 17 15 33 0 10-7 19-18 24 5-9-1-15-7-21-5-6-6-14 9-24-2 10 8 15 10 24C42 19 21 16 25 2Z"/><path d="M22 56c-7-5-10-11-8-17 1-5 5-8 10-12-3 9 6 13 3 22 6-5 4-10 2-15 8 9 5 17-7 22Z" fill="var(--ember-pale)"/></svg>`;
}

export function mageSvg() {
  return `<svg viewBox="0 0 100 145" aria-hidden="true">
    <path d="M67 39c10 13 11 27 8 42l12 49H26l8-49c-4-15-2-29 7-42Z" fill="#314750" stroke="#17150f" stroke-width="4"/>
    <path d="M50 9c-19 9-24 30-12 45 7 8 25 8 33 0 8-9 5-34-21-45Z" fill="#405965" stroke="#17150f" stroke-width="4"/>
    <path d="M47 31c-7 4-7 14 1 19 5 3 13 0 15-6 3-8-7-17-16-13Z" fill="#d3a97c"/>
    <path d="M43 37c4 3 10 2 15-1M53 39l-1 5" fill="none" stroke="#17150f" stroke-width="2"/>
    <path d="M18 128 30 41" fill="none" stroke="#231c13" stroke-width="6" stroke-linecap="round"/>
    <path d="M31 39c-8 1-12-4-9-10 2-5 8-6 11-2 5-5 12-2 12 4 0 6-7 10-14 8Z" fill="#ef6c34" stroke="#17150f" stroke-width="3"/>
    <path d="M42 68 27 84M65 70l17 13" fill="none" stroke="#334b55" stroke-width="12" stroke-linecap="round"/>
    <path d="M39 122h40M30 130h57" stroke="#17150f" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}

const ENEMY_ART = {
  ashRaider: `<path d="M28 121 36 62l-5-22 22-20 27 17-8 24 6 60Z" fill="#70483a" stroke="#17150f" stroke-width="5"/><path d="m36 38 11-22 31 20-9 22Z" fill="#392c28" stroke="#17150f" stroke-width="5"/><path d="M47 41h18l-4 12H48Z" fill="#bc7c52"/><path d="m72 68 17-26M85 40l8 1-3 8" fill="none" stroke="#17150f" stroke-width="6" stroke-linecap="round"/>`,
  cinderHound: `<path d="M12 93c10-27 23-43 42-43 13 0 24 8 31 22l-6 28H26Z" fill="#4a352f" stroke="#17150f" stroke-width="5"/><path d="m38 53-7-28 21 19 15-24 5 36" fill="#5e3b31" stroke="#17150f" stroke-width="5"/><path d="m42 59 11 5-13 6M65 58l9 4-11 7" fill="none" stroke="#ef8b4c" stroke-width="3"/><path d="M29 95 20 124M72 95l11 29" stroke="#17150f" stroke-width="8" stroke-linecap="round"/>`,
  keepGuard: `<path d="M22 126 32 54l18-18 27 16 7 74Z" fill="#5c625f" stroke="#17150f" stroke-width="5"/><path d="M34 53V24l17-15 23 15 2 32Z" fill="#444b4a" stroke="#17150f" stroke-width="5"/><path d="M42 34h26" stroke="#ef8b4c" stroke-width="4"/><path d="m18 63 26 13-9 43L9 104Z" fill="#4f5957" stroke="#17150f" stroke-width="5"/><path d="m75 61 18 49" stroke="#17150f" stroke-width="8"/>`,
  emberSeer: `<path d="M22 128 36 51c-5-15 2-34 18-41 15 8 22 25 16 42l13 76Z" fill="#6d3b38" stroke="#17150f" stroke-width="5"/><path d="M40 36c3-12 21-16 27-2l-5 18H43Z" fill="#261f24"/><path d="M49 38h5M59 38h5" stroke="#ff9b4a" stroke-width="3"/><path d="M20 126 13 40M13 39c7 3 13-4 10-10-3-5-10-5-13 0-4-4-10-1-10 5 0 6 6 9 13 5Z" fill="#ed6734" stroke="#17150f" stroke-width="4"/>`,
  emberling: `<path d="M50 17c5 20 27 27 24 55-2 18-13 29-29 38 7-14-1-23-10-31-7-8-9-19 12-34-2 13 10 20 13 32 10-24-18-34-10-60Z" fill="#ed6734" stroke="#17150f" stroke-width="5"/><path d="M42 103 31 128M61 102l13 26" stroke="#17150f" stroke-width="7" stroke-linecap="round"/><circle cx="47" cy="68" r="3" fill="#17150f"/><circle cx="60" cy="68" r="3" fill="#17150f"/>`,
  fallenWarden: `<path d="M14 132 27 55 47 37l30 18 12 77Z" fill="#322b33" stroke="#17150f" stroke-width="5"/><path d="M30 56 27 24 49 8l28 17-2 34Z" fill="#242126" stroke="#17150f" stroke-width="5"/><path d="m29 25 10-18 10 15L61 3l6 21 14-12-4 23" fill="#6e3931" stroke="#17150f" stroke-width="4"/><path d="M39 39h28" stroke="#ff9b4a" stroke-width="4"/><path d="m79 60 14 62M89 67l9-12" stroke="#17150f" stroke-width="8" stroke-linecap="round"/><path d="M26 78 9 92l11 34" fill="none" stroke="#17150f" stroke-width="9" stroke-linecap="round"/>`,
};

export function enemySvg(type) {
  return `<svg viewBox="0 0 105 145" aria-hidden="true">${ENEMY_ART[type] || ENEMY_ART.emberling}<path d="M12 131h82" stroke="#17150f" stroke-width="5" stroke-linecap="round"/></svg>`;
}

export function storyIllustration(name) {
  const art = {
    "ashen-road": `<path d="M7 223 67 130l41 40 48-95 91 148Z" fill="#26322c" stroke="#17150f" stroke-width="6"/><path d="M25 219c58-45 103-34 210-81" fill="none" stroke="#d6bd84" stroke-width="11" stroke-dasharray="3 14" stroke-linecap="round"/><path d="M103 145c-6-33 8-54 27-67 24 15 30 42 22 70Z" fill="#8f4536" stroke="#17150f" stroke-width="6"/><path d="m123 84 9-31 18 29" fill="#3b2b28" stroke="#17150f" stroke-width="6"/><path d="M174 183c8-29 25-47 47-47l24 35-12 43h-47Z" fill="#4a352f" stroke="#17150f" stroke-width="6"/><path d="m191 143-7-27 23 18 17-24 3 35" fill="#5e3b31" stroke="#17150f" stroke-width="5"/>`,
    "scorched-keep": `<path d="M43 225V83l24-18v36l36-28v28l31-41 34 40V71l45 29v125Z" fill="#3a302d" stroke="#17150f" stroke-width="7"/><path d="M105 225v-61c0-35 49-35 49 0v61" fill="#17150f"/><path d="M55 126h29M174 126h27" stroke="#ef6d34" stroke-width="8"/><path d="M23 226h215" stroke="#17150f" stroke-width="9" stroke-linecap="round"/><path d="M118 165c8 9 20 9 28 0" fill="none" stroke="#ed6734" stroke-width="5"/>`,
    emberfall: `<circle cx="130" cy="113" r="76" fill="#352a30" stroke="#17150f" stroke-width="7"/><path d="M130 42c5 31 42 42 38 84-2 28-19 45-44 58 11-21-2-35-16-47-11-12-14-29 18-52-3 19 16 30 20 48 15-36-27-51-16-91Z" fill="#ed6734" stroke="#17150f" stroke-width="6"/><path d="m65 96 16-37 27 28 22-52 24 52 27-28 16 37" fill="none" stroke="#e3d3b1" stroke-width="8"/><path d="M42 213c55-34 121-33 176 0" fill="none" stroke="#17150f" stroke-width="10" stroke-linecap="round"/>`,
    cinderwatch: `<path d="M25 223h210M48 222v-92l50-32v124M99 222V69l50-35v188M149 222v-107l63-32v139" fill="#536262" stroke="#17150f" stroke-width="7"/><path d="M70 155h15M116 99h18M116 130h18M171 141h20M171 169h20" stroke="#ffd07b" stroke-width="8"/><path d="M131 34V8M120 18h22" stroke="#17150f" stroke-width="6"/>`,
    emberforge: `<path d="M38 208h184M58 205l18-77h108l18 77" fill="#40322a" stroke="#17150f" stroke-width="8"/><path d="M86 126c0-32 16-52 45-72 28 24 44 45 42 72Z" fill="#ed6734" stroke="#17150f" stroke-width="7"/><path d="M113 125c-6-18 2-31 18-45-3 19 21 26 7 45" fill="#ffd06b"/><path d="M57 129h145" stroke="#17150f" stroke-width="9"/><path d="M104 170h54l-8 22h-38Z" fill="#768184" stroke="#17150f" stroke-width="6"/><path d="m128 170-6-53" stroke="#17150f" stroke-width="7"/>`,
  };
  return `<svg viewBox="0 0 260 260" aria-hidden="true">${art[name] || art.emberfall}</svg>`;
}

export function mapIcon(name) {
  const paths = {
    camp: `<path d="m3 20 9-17 9 17M7 20l5-9 5 9M3 20h18"/><path d="M12 11v9"/>`,
    swords: `<path d="m5 4 15 15M19 4 4 19M15 3l6 6M3 15l6 6"/>`,
    town: `<path d="M3 21V10l6-4v15M9 21V7l6-4v18M15 21v-9l6-4v13M2 21h20"/><path d="M12 8h1M5 13h1M17 14h1"/>`,
    keep: `<path d="M4 21V8h4V4h4v4h4V4h4v17M2 21h20M9 21v-6a3 3 0 0 1 6 0v6"/>`,
    forge: `<path d="M4 20h16M6 20l2-8h8l2 8M9 12c0-3 1-5 4-7 3 2 4 4 3 7"/><path d="M7 12h11"/>`,
    crown: `<path d="m3 18 2-11 5 5 2-9 3 9 5-5 1 11H3Z"/><path d="M4 21h16"/>`,
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
