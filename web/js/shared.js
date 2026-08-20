export const PROF_ORDER = ["PIONEER", "WARRIOR", "TANK", "SNIPER", "CASTER", "MEDIC", "SUPPORT", "SPECIAL"];

const PROF_ICON_FILE = {
  PIONEER: "vanguard",
  WARRIOR: "guard",
  TANK: "defender",
  SNIPER: "sniper",
  CASTER: "caster",
  MEDIC: "medic",
  SUPPORT: "supporter",
  SPECIAL: "specialist",
};

const ATK_SVG = `<svg viewBox="0 0 36 36" aria-hidden="true">
  <g transform="rotate(45 18 18)" fill="none">
    <path fill="#f2f5f8" d="M18 3.2 22.1 20.2H13.9Z"/>
    <rect x="17.2" y="8.2" width="1.6" height="9.4" rx="0.6" fill="#8b97a3"/>
    <rect x="11.2" y="19.5" width="13.6" height="2.5" rx="0.7" fill="#e8eef4"/>
    <rect x="16.15" y="21.8" width="3.7" height="6.8" rx="0.9" fill="#9aa8b5"/>
    <circle cx="18" cy="30" r="2.2" fill="#e8eef4"/>
  </g>
</svg>`;

const AVATARS = [
  (id) => `https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/${id}.png`,
  (id) => `https://raw.githubusercontent.com/Aceship/Arknight-Images/main/avatars/${id}.png`,
];
const PORTRAITS = [
  (id) => `https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/portrait/${id}_1.png`,
  (id) => `https://raw.githubusercontent.com/Aceship/Arknight-Images/main/portraits/${id}_1.png`,
];
const SKILL_ICONS = [
  (id) => `https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/skill/skill_icon_${id}.png`,
  (id) => `https://raw.githubusercontent.com/Aceship/Arknight-Images/main/skills/skill_icon_${id}.png`,
];

function chainedImg(urls, cls) {
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  let step = 0;
  img.src = urls[0];
  img.addEventListener("error", () => {
    step += 1;
    if (step < urls.length) img.src = urls[step];
  });
  if (cls) img.className = cls;
  return img;
}

export function imgEl(id, cls = "") {
  return chainedImg(AVATARS.map((fn) => fn(id)), cls);
}

export function portraitEl(id) {
  return chainedImg(
    PORTRAITS.map((fn) => fn(id)).concat(AVATARS.map((fn) => fn(id))),
    "portrait-img"
  );
}

export function skillIconEl(iconId) {
  return chainedImg(SKILL_ICONS.map((fn) => fn(iconId)), "skill-icon");
}

export function profIconEl(id, cls = "prof-ico") {
  const img = document.createElement("img");
  img.className = cls;
  img.alt = "";
  img.draggable = false;
  const slug = PROF_ICON_FILE[id];
  if (slug) img.src = `img/prof/${slug}.png`;
  return img;
}

export function profIconHtml(id, cls = "prof-ico") {
  const slug = PROF_ICON_FILE[id];
  if (!slug) return "";
  return `<img class="${cls}" alt="" draggable="false" src="img/prof/${slug}.png">`;
}

export function atkIconEl(cls = "skill-icon atk-icon") {
  const wrap = document.createElement("span");
  wrap.className = cls;
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = ATK_SVG;
  return wrap;
}

export function atkIconHtml(cls = "skill-icon atk-icon") {
  return `<span class="${cls}" aria-hidden="true">${ATK_SVG}</span>`;
}

export function profName(data, id) {
  return data.professions.find((p) => p.id === id)?.name || id;
}

export function branchOf(data, id) {
  return data.branches.find((b) => b.id === id);
}

export function rangeOf(data, id) {
  return data.ranges[id] || { id, grids: [{ row: 0, col: 0 }] };
}

export function stars(n) {
  return "★".repeat(n);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolates a phase's min/max stat frame at a given level (1..phase.maxLevel).
export function baseStatsAt(phase, level) {
  const maxLv = phase.maxLevel;
  const t = maxLv <= 1 ? 1 : (level - 1) / (maxLv - 1);
  const out = {};
  for (const key of Object.keys(phase.min)) {
    const raw = lerp(phase.min[key], phase.max[key], t);
    out[key] = key === "interval" || key === "res" ? Math.round(raw * 100) / 100 : Math.round(raw);
  }
  return out;
}

// Adds trust bonus scaled by ratio (0..1) onto stats produced by baseStatsAt. Mutates and returns stats.
export function applyTrust(stats, trust, ratio) {
  if (!trust || !ratio) return stats;
  stats.hp += Math.round((trust.hp || 0) * ratio);
  stats.atk += Math.round((trust.atk || 0) * ratio);
  stats.def += Math.round((trust.def || 0) * ratio);
  stats.res += Math.round((trust.res || 0) * ratio * 100) / 100;
  return stats;
}

// Derives DPS from atk/interval onto stats. Mutates and returns stats.
export function withDps(stats) {
  stats.dps = stats.interval ? Math.round((stats.atk / stats.interval) * 10) / 10 : 0;
  return stats;
}

export function setAccent(el, prof) {
  el.style.setProperty("--accent", `var(--${prof})`);
}

// Covers every range currently in the dataset (row -3..3, col -3..6).
export const RANGE_FRAME = { minRow: -3, maxRow: 3, minCol: -3, maxCol: 6 };

export function renderRange(data, rangeId, accent, cellSize, frame = null) {
  const info = rangeOf(data, rangeId);
  const grids = info.grids || [];
  const set = new Set(grids.map((g) => `${g.row},${g.col}`));
  set.add("0,0");
  let minR, maxR, minC, maxC;
  if (frame) {
    minR = frame.minRow;
    maxR = frame.maxRow;
    minC = frame.minCol;
    maxC = frame.maxCol;
  } else {
    const rows = [...new Set(grids.map((g) => g.row).concat(0))];
    const cols = [...new Set(grids.map((g) => g.col).concat(0))];
    minR = Math.min(...rows);
    maxR = Math.max(...rows);
    minC = Math.min(...cols);
    maxC = Math.max(...cols);
  }
  const colsN = maxC - minC + 1;
  const rowsN = maxR - minR + 1;
  const wrap = document.createElement("div");
  wrap.className = frame ? "range-board range-fixed" : cellSize > 14 ? "range-board" : "range-mini";
  wrap.style.setProperty("--cell", `${cellSize}px`);
  wrap.style.setProperty("--accent", accent);
  wrap.style.gridTemplateColumns = `repeat(${colsN}, var(--cell))`;
  wrap.style.gridTemplateRows = `repeat(${rowsN}, var(--cell))`;
  for (let r = maxR; r >= minR; r -= 1) {
    for (let c = minC; c <= maxC; c += 1) {
      const cell = document.createElement("i");
      cell.className = "cell";
      if (r === 0 && c === 0) cell.classList.add("self");
      else if (set.has(`${r},${c}`)) cell.classList.add("on");
      else cell.classList.add("off");
      wrap.appendChild(cell);
    }
  }
  return wrap;
}
