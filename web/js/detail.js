import {
  RANGE_FRAME,
  atkIconEl,
  atkIconHtml,
  branchOf,
  imgEl,
  profIconEl,
  skillIconEl,
  profName,
  renderRange,
  setAccent,
  stars,
} from "./shared.js";

const SKILL_TYPE = { MANUAL: "手動觸發", AUTO: "自動觸發", PASSIVE: "被動" };
const SP_TYPE = {
  INCREASE_WITH_TIME: "自動回復",
  INCREASE_WHEN_ATTACK: "攻擊回復",
  INCREASE_WHEN_TAKEN_DAMAGE: "受擊回復",
  "1": "自動回復",
  "2": "攻擊回復",
  "4": "受擊回復",
  "8": "被動",
};

const BASIC_SKILL = -1;
let termDict = {};
let tipEl = null;

export function createDetailState(op) {
  const maxElite = op.maxElite ?? op.phases.length - 1;
  return {
    id: op.id,
    elite: maxElite,
    levelByElite: op.phases.map((p) => p.maxLevel),
    potential: 1,
    trust: 200,
    skillIndex: BASIC_SKILL,
    skillLevel: null,
  };
}

export function computeStats(op, detail) {
  const elite = Math.min(detail.elite, op.phases.length - 1);
  const phase = op.phases[elite];
  const maxLv = phase.maxLevel;
  const level = clamp(detail.levelByElite[elite] ?? maxLv, 1, maxLv);
  const t = maxLv <= 1 ? 1 : (level - 1) / (maxLv - 1);
  const out = {};
  for (const key of Object.keys(phase.min)) {
    const raw = phase.min[key] + (phase.max[key] - phase.min[key]) * t;
    out[key] = key === "interval" || key === "res" ? Math.round(raw * 100) / 100 : Math.round(raw);
  }
  const trustRatio = clamp(detail.trust, 0, 200) / 200;
  if (op.trust && trustRatio) {
    out.hp += Math.round((op.trust.hp || 0) * trustRatio);
    out.atk += Math.round((op.trust.atk || 0) * trustRatio);
    out.def += Math.round((op.trust.def || 0) * trustRatio);
    out.res += Math.round(((op.trust.res || 0) * trustRatio) * 100) / 100;
  }
  const potRank = clamp(detail.potential, 1, op.maxPotential || 1) - 1;
  for (let i = 0; i < potRank; i += 1) {
    const bonus = (op.potentials || [])[i];
    if (!bonus) continue;
    for (const [k, v] of Object.entries(bonus.stats || {})) {
      if (k in out) out[k] += v;
      else out[k] = v;
    }
  }
  if ("cost" in out) out.cost = Math.max(0, Math.round(out.cost));
  if ("redeploy" in out) out.redeploy = Math.max(0, Math.round(out.redeploy));
  if ("block" in out) out.block = Math.round(out.block);
  if ("aspd" in out) out.aspd = Math.round(out.aspd);
  out.dps = out.interval ? Math.round((out.atk / out.interval) * 10) / 10 : 0;
  out.level = level;
  out.elite = elite;
  return out;
}

export function formatSkillDesc(desc, blackboard, terms) {
  if (terms) termDict = terms;
  if (!desc) return "";
  let text = desc.replace(/\{([^}:]+)(?::([^}]+))?\}/g, (_, key, fmt) => {
    const val = lookupBlackboard(blackboard || {}, key);
    if (val == null) return "";
    return formatBlackboard(val, fmt);
  });
  text = text.replace(/<@[A-Za-z0-9._]+>/g, (tag) => {
    if (tag.includes("vdown")) return '<span class="vdown">';
    if (tag.includes("vup")) return '<span class="vup">';
    if (tag.includes("talpu") || tag.includes("rem")) return '<span class="rem">';
    return '<span class="kw">';
  });
  text = text.replace(/<\$([A-Za-z0-9._]+)>/g, (_, id) => {
    const term = termDict[id];
    if (!term) return '<span class="kw term">';
    return `<span class="kw term" data-term="${esc(id)}">`;
  });
  text = text.replace(/<\/>/g, "</span>");
  text = text.replace(/<([^<>]+)>/g, (all, inner) => {
    if (/^\/?(span|br)\b/i.test(inner)) return all;
    return `<span class="kw">${inner}</span>`;
  });
  return text.replace(/\n/g, "<br>");
}

function pickEntry(entries, elite, potRank) {
  const ok = (entries || []).filter((e) => e.elite <= elite && (e.pot || 0) <= potRank);
  if (!ok.length) return null;
  ok.sort((a, b) => a.elite - b.elite || (a.pot || 0) - (b.pot || 0));
  return ok[ok.length - 1];
}

export function activeTrait(op, elite, potential) {
  const potRank = clamp(potential, 1, op.maxPotential || 1) - 1;
  return pickEntry(op.traitEntries, elite, potRank);
}

export function activeTalents(op, elite, potential) {
  const potRank = clamp(potential, 1, op.maxPotential || 1) - 1;
  const result = [];
  for (const talent of op.talents || []) {
    const hit = pickEntry(talent.entries, elite, potRank);
    if (hit) result.push(hit);
  }
  return result;
}

export function renderOperator(app, data, op, detail, handlers) {
  if (data.terms) termDict = data.terms;
  ensureTermTips();
  const branch = branchOf(data, op.branchId);
  const wrap = document.createElement("div");
  wrap.className = "dossier";
  wrap.dataset.id = op.id;
  setAccent(wrap, op.profession);

  const head = document.createElement("header");
  head.className = "file-head";
  const back = document.createElement("button");
  back.className = "back";
  back.type = "button";
  back.textContent = "← 返回";
  back.addEventListener("click", handlers.onBack);
  const face = imgEl(op.id, "file-avatar");
  const wiki = document.createElement("a");
  wiki.className = "file-avatar-link";
  wiki.href = prtsWikiUrl(op);
  wiki.target = "_blank";
  wiki.rel = "noopener noreferrer";
  wiki.title = `在 PRTS Wiki 開啟「${op.name}」`;
  wiki.setAttribute("aria-label", `在 PRTS Wiki 開啟「${op.name}」`);
  wiki.appendChild(face);
  const meta = document.createElement("div");
  meta.className = "file-meta";
  const h = document.createElement("h1");
  h.textContent = op.name;
  const sub = document.createElement("p");
  sub.className = "file-sub";
  const aka = document.createElement("span");
  aka.className = "aka";
  aka.textContent = op.nameEn;
  const prof = document.createElement("span");
  prof.className = "file-prof";
  prof.append(profIconEl(op.profession, "prof-ico"), document.createTextNode(profName(data, op.profession)));
  const branchName = document.createElement("span");
  branchName.textContent = branch?.name || "";
  const starEl = document.createElement("span");
  starEl.className = "stars";
  starEl.textContent = stars(op.rarity);
  const dot = () => {
    const d = document.createElement("span");
    d.className = "dot";
    d.textContent = "·";
    return d;
  };
  sub.append(aka, dot(), prof, dot(), branchName, dot(), starEl);
  meta.append(h, sub);
  head.append(back, wiki, meta);

  const body = document.createElement("div");
  body.className = "file-body";
  const left = document.createElement("div");
  left.className = "file-left";
  left.append(statBlock(), controlBlock(op, detail, handlers), rangeBlock());
  const right = document.createElement("div");
  right.className = "file-right";
  const trait = document.createElement("div");
  trait.className = "glass trait-box";
  trait.innerHTML = `<div class="panel-h">特性</div><p class="trait-text" data-slot="trait"></p>`;
  const talents = document.createElement("div");
  talents.className = "glass";
  talents.innerHTML = `<div class="panel-h">天賦</div><div data-slot="talents"></div>`;
  right.append(trait, talents, skillBlock(data, op, detail, handlers));
  body.append(left, right);

  wrap.append(head, body);
  app.replaceChildren(wrap);
  syncDetail(app, data, op, detail);
}

export function syncDetail(root, data, op, detail) {
  const stats = computeStats(op, detail);
  const elite = stats.elite;
  const phase = op.phases[elite];
  write(root, "level", stats.level);
  write(root, "level-max", phase.maxLevel);
  write(root, "trust", detail.trust);
  write(root, "potential-label", detail.potential);
  write(root, "hp", stats.hp);
  write(root, "atk", stats.atk);
  write(root, "def", stats.def);
  write(root, "res", stats.res);
  write(root, "cost", stats.cost);
  write(root, "block", stats.block);
  write(root, "interval", `${stats.interval}s`);
  write(root, "redeploy", `${stats.redeploy}s`);
  write(root, "dps", stats.dps);

  const levelInput = root.querySelector("[data-input=level]");
  if (levelInput) {
    levelInput.dataset.max = String(phase.maxLevel);
    levelInput.max = String(phase.maxLevel);
    levelInput.value = String(stats.level);
  }
  const trustInput = root.querySelector("[data-input=trust]");
  if (trustInput) trustInput.value = String(detail.trust);

  root.querySelectorAll("[data-elite]").forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.elite) === elite);
  });
  root.querySelectorAll("[data-pot]").forEach((btn) => {
    const n = Number(btn.dataset.pot);
    btn.classList.toggle("on", n <= detail.potential);
    btn.classList.toggle("current", n === detail.potential);
  });

  const rangeSlot = root.querySelector("[data-slot=range]");
  const rangeMode = root.querySelector("[data-slot=range-mode]");
  if (rangeSlot) {
    const shown = shownRange(data, op, detail, phase);
    rangeSlot.replaceChildren(renderRange(data, shown.rangeId, `var(--${op.profession})`, 22, RANGE_FRAME));
    if (rangeMode) {
      rangeMode.textContent = shown.label;
      rangeMode.classList.toggle("is-skill", shown.mode === "skill");
    }
  }

  const traitSlot = root.querySelector("[data-slot=trait]");
  if (traitSlot) {
    const entry = activeTrait(op, elite, detail.potential);
    traitSlot.innerHTML = entry
      ? formatSkillDesc(entry.desc, entry.blackboard || {}, data.terms)
      : formatSkillDesc(op.trait, {}, data.terms);
  }

  const talentSlot = root.querySelector("[data-slot=talents]");
  if (talentSlot) {
    const talents = activeTalents(op, elite, detail.potential);
    talentSlot.replaceChildren();
    if (!talents.length) {
      talentSlot.innerHTML = `<p class="muted">這個精英化階段沒有天賦。</p>`;
    } else {
      for (const t of talents) {
        const row = document.createElement("div");
        row.className = "talent";
        row.innerHTML = `<div class="talent-name">${esc(t.name)}</div><div class="talent-desc">${formatSkillDesc(t.desc, {}, data.terms)}</div>`;
        talentSlot.appendChild(row);
      }
    }
  }

  syncSkillPanel(root, data, op, detail);
}

function controlBlock(op, detail, handlers) {
  const box = document.createElement("div");
  box.className = "glass ctrl-card";
  box.append(
    eliteRow(op, detail, handlers),
    stepperRow("等級", "level", 1, op.phases[detail.elite]?.maxLevel || 1, detail.levelByElite[detail.elite], 1, handlers.onLevel),
    potRow(op, detail, handlers),
    stepperRow("信賴", "trust", 0, 200, detail.trust, 10, handlers.onTrust)
  );
  return box;
}

function eliteRow(op, detail, handlers) {
  const row = document.createElement("div");
  row.className = "ctrl elite-row";
  row.innerHTML = `<span class="ctrl-k">精英化</span>`;
  const group = document.createElement("div");
  group.className = "seg";
  for (let i = 0; i <= (op.maxElite ?? 0); i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.elite = String(i);
    btn.className = "seg-btn" + (detail.elite === i ? " on" : "");
    btn.textContent = `精 ${i}`;
    btn.addEventListener("click", () => handlers.onElite(i));
    group.appendChild(btn);
  }
  row.appendChild(group);
  return row;
}

function potRow(op, detail, handlers) {
  const max = op.maxPotential || 1;
  const row = document.createElement("div");
  row.className = "ctrl";
  row.innerHTML = `<span class="ctrl-k">潛能</span>`;
  const group = document.createElement("div");
  group.className = "pips";
  for (let i = 1; i <= max; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.pot = String(i);
    btn.className = "pip" + (i <= detail.potential ? " on" : "");
    const desc = i === 1 ? "初始" : (op.potentials || [])[i - 2]?.desc || "";
    btn.title = desc ? `潛能 ${i}　${desc}` : `潛能 ${i}`;
    btn.addEventListener("click", () => handlers.onPotential(i));
    group.appendChild(btn);
  }
  const label = document.createElement("span");
  label.className = "ctrl-v";
  label.innerHTML = `<span data-bind="potential-label">${detail.potential}</span>/${max}`;
  row.append(group, label);
  return row;
}

function stepperRow(label, key, min, max, value, step, onChange) {
  const row = document.createElement("div");
  row.className = "ctrl step-row";
  const name = document.createElement("span");
  name.className = "ctrl-k";
  name.textContent = label;
  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "step-btn";
  minus.textContent = "−";
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.className = "step-input num";
  input.value = String(value);
  input.dataset.input = key;
  input.dataset.min = String(min);
  input.dataset.max = String(max);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "step-btn";
  plus.textContent = "+";
  const cap = document.createElement("span");
  cap.className = "ctrl-v";
  if (key === "level") cap.innerHTML = `/<span data-bind="level-max">${max}</span>`;
  const apply = (raw) => {
    const lo = Number(input.dataset.min);
    const hi = Number(input.dataset.max);
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(Math.max(lo, Math.min(hi, Math.round(n))));
  };
  minus.addEventListener("click", () => apply(Number(input.value) - step));
  plus.addEventListener("click", () => apply(Number(input.value) + step));
  input.addEventListener("change", () => apply(input.value));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      apply(input.value);
      input.blur();
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      apply(Number(input.value) + step);
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      apply(Number(input.value) - step);
    }
  });
  const cluster = document.createElement("div");
  cluster.className = "step-cluster";
  cluster.append(minus, input, plus);
  row.append(name, cluster, cap);
  return row;
}

function statBlock() {
  const box = document.createElement("div");
  box.className = "glass stat-card";
  const grid = document.createElement("div");
  grid.className = "stat-cols";
  const rows = [
    ["hp", "生命"],
    ["atk", "攻擊"],
    ["def", "防禦"],
    ["res", "法抗"],
    ["cost", "費用"],
    ["block", "阻擋"],
    ["interval", "間隔"],
    ["redeploy", "再部署(s)"],
    ["dps", "DPS"],
  ];
  for (const [key, label] of rows) {
    const row = document.createElement("div");
    row.className = "stat";
    row.innerHTML = `<span>${label}</span><b class="num" data-bind="${key}">—</b>`;
    grid.appendChild(row);
  }
  box.appendChild(grid);
  return box;
}

function rangeBlock() {
  const box = document.createElement("div");
  box.className = "glass range-card";
  box.innerHTML = `
    <div class="panel-h">
      攻擊範圍
      <span class="range-mode" data-slot="range-mode"></span>
    </div>
    <div data-slot="range"></div>`;
  return box;
}

function skillBlock(data, op, detail, handlers) {
  const panel = document.createElement("div");
  panel.className = "glass skill-panel";
  const head = document.createElement("div");
  head.className = "panel-h";
  head.textContent = "技能";
  const tabs = document.createElement("div");
  tabs.className = "skill-tabs";
  const basic = document.createElement("button");
  basic.type = "button";
  basic.className = "skill-tab" + (detail.skillIndex === BASIC_SKILL ? " on" : "");
  basic.dataset.skill = String(BASIC_SKILL);
  basic.title = "普通攻擊";
  const basicIcon = atkIconEl();
  const basicTag = document.createElement("span");
  basicTag.textContent = "普攻";
  basic.append(basicIcon, basicTag);
  basic.addEventListener("click", () => handlers.onSkill(BASIC_SKILL));
  tabs.appendChild(basic);
  (op.skillRefs || []).forEach((ref, i) => {
    const skill = data.skills[ref.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-tab" + (i === detail.skillIndex ? " on" : "");
    btn.dataset.skill = String(i);
    btn.title = skill?.levels?.[0]?.name || `技能 ${i + 1}`;
    btn.appendChild(skillIconEl(skill?.icon || ref.id));
    const tag = document.createElement("span");
    tag.textContent = `S${i + 1}`;
    btn.appendChild(tag);
    btn.addEventListener("click", () => handlers.onSkill(i));
    tabs.appendChild(btn);
  });
  const levels = document.createElement("div");
  levels.className = "skill-levels";
  levels.dataset.slot = "skill-levels";
  const body = document.createElement("div");
  body.className = "skill-body";
  body.dataset.slot = "skill-body";
  panel.append(head, tabs, levels, body);
  return panel;
}

function syncSkillPanel(root, data, op, detail) {
  const refs = op.skillRefs || [];
  root.querySelectorAll("[data-skill]").forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.skill) === detail.skillIndex);
  });
  const lvSlot = root.querySelector("[data-slot=skill-levels]");
  const body = root.querySelector("[data-slot=skill-body]");
  if (!lvSlot || !body) return;
  if (detail.skillIndex === BASIC_SKILL) {
    lvSlot.replaceChildren();
    delete lvSlot.dataset.skill;
    const entry = activeTrait(op, detail.elite, detail.potential);
    const desc = entry
      ? formatSkillDesc(entry.desc, entry.blackboard || {}, data.terms)
      : formatSkillDesc(op.trait, {}, data.terms);
    body.innerHTML = `
      <div class="skill-head">
        ${atkIconHtml()}
        <div>
          <div class="skill-name">普通攻擊</div>
          <div class="skill-meta">${esc(op.position || "")}　${esc(damageHint(op.trait))}</div>
          <div class="skill-sp">特性說明 · 左下為普通攻擊範圍</div>
        </div>
      </div>
      <div class="skill-desc">${desc || `<span class="muted">沒有普通攻擊說明。</span>`}</div>
    `;
    return;
  }
  if (!refs.length) {
    lvSlot.replaceChildren();
    body.innerHTML = `<p class="muted">這名幹員沒有技能。</p>`;
    return;
  }
  const ref = refs[detail.skillIndex] || refs[0];
  const skill = data.skills[ref.id];
  if (!skill) {
    body.innerHTML = `<p class="muted">沒有這項技能資料。</p>`;
    return;
  }
  const maxLv = skill.levels.length;
  const idx = clamp(detail.skillLevel ?? maxLv - 1, 0, maxLv - 1);
  detail.skillLevel = idx;
  if (lvSlot.childElementCount !== maxLv || lvSlot.dataset.skill !== ref.id) {
    lvSlot.replaceChildren();
    lvSlot.dataset.skill = ref.id;
    for (let i = 0; i < maxLv; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lv-btn" + (i >= 7 ? " master" : "");
      btn.dataset.lv = String(i);
      btn.textContent = i < 7 ? String(i + 1) : `專${["Ⅰ", "Ⅱ", "Ⅲ"][i - 7]}`;
      btn.addEventListener("click", () => {
        detail.skillLevel = i;
        syncDetail(root, data, op, detail);
      });
      lvSlot.appendChild(btn);
    }
  }
  lvSlot.querySelectorAll(".lv-btn").forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.lv) === idx);
  });

  const lv = skill.levels[idx];
  const needElite = ref.unlockElite || 0;
  const locked = detail.elite < needElite;
  const dur = formatDuration(lv.duration);
  const spType = SP_TYPE[lv.spType] || (lv.type === "PASSIVE" ? "被動" : lv.spType);
  const type = SKILL_TYPE[lv.type] || lv.type;
  const hint = locked ? `<div class="lock-note">精 ${needElite} 解鎖，目前僅預覽</div>` : "";
  body.innerHTML = `
    <div class="skill-head">
      ${skillIconEl(skill.icon).outerHTML}
      <div>
        <div class="skill-name">${esc(lv.name)}</div>
        <div class="skill-meta">${spType}　${type}${dur ? "　持續 " + dur : ""}</div>
        <div class="skill-sp">${lv.type === "PASSIVE" ? "被動技能" : `初始 ${lv.initSp}　消耗 ${lv.spCost}`}</div>
      </div>
    </div>
    ${hint}
    <div class="skill-desc">${formatSkillDesc(lv.desc, { duration: lv.duration, ...(lv.blackboard || {}) }, data.terms)}</div>
  `;
}

function shownRange(data, op, detail, phase) {
  if (detail.skillIndex === BASIC_SKILL) {
    return { rangeId: phase.rangeId, mode: "basic", label: "普通攻擊範圍" };
  }
  const skill = currentSkillLevel(data, op, detail);
  const skillRange = skill?.rangeId;
  if (skillRange && skillRange !== phase.rangeId) {
    const name = skill.name ? `「${skill.name}」` : "技能";
    return { rangeId: skillRange, mode: "skill", label: `目前顯示${name}的攻擊範圍` };
  }
  return { rangeId: phase.rangeId, mode: "same", label: "與普通攻擊相同" };
}

function damageHint(trait) {
  const t = trait || "";
  if (t.includes("元素")) return "元素";
  if (t.includes("治療") || t.includes("恢復") || t.includes("回復") || (t.includes("生命") && t.includes("不攻擊"))) {
    return "治療";
  }
  if (t.includes("法術")) return "法術";
  if (t.includes("不攻擊") || t.includes("不進行攻擊")) return "不攻擊";
  if (t.includes("物理")) return "物理";
  return "物理";
}

function ensureTermTips() {
  if (tipEl) return;
  tipEl = document.createElement("div");
  tipEl.className = "term-tip";
  tipEl.hidden = true;
  tipEl.setAttribute("role", "tooltip");
  document.body.appendChild(tipEl);
  document.addEventListener("pointerover", (ev) => {
    const el = ev.target.closest?.(".term[data-term]");
    if (el) showTermTip(el);
  });
  document.addEventListener("pointerout", (ev) => {
    const el = ev.target.closest?.(".term[data-term]");
    if (!el) return;
    const next = ev.relatedTarget;
    if (next && (el.contains(next) || tipEl.contains(next))) return;
    hideTermTip();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") hideTermTip();
  });
  window.addEventListener("scroll", hideTermTip, true);
  window.addEventListener("resize", hideTermTip);
}

function showTermTip(el) {
  const term = termDict[el.dataset.term];
  if (!term || !tipEl) return;
  tipEl.innerHTML = `<b>${esc(term.name)}</b><p>${esc(term.desc)}</p>`;
  tipEl.hidden = false;
  const rect = el.getBoundingClientRect();
  const pad = 8;
  const width = tipEl.offsetWidth;
  const height = tipEl.offsetHeight;
  let left = rect.left;
  let top = rect.bottom + 8;
  if (left + width > window.innerWidth - pad) left = window.innerWidth - width - pad;
  if (left < pad) left = pad;
  if (top + height > window.innerHeight - pad) top = rect.top - height - 8;
  if (top < pad) top = pad;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
}

function hideTermTip() {
  if (!tipEl) return;
  tipEl.hidden = true;
}

function currentSkillLevel(data, op, detail) {
  const ref = (op.skillRefs || [])[detail.skillIndex];
  if (!ref) return null;
  const skill = data.skills[ref.id];
  if (!skill) return null;
  const idx = clamp(detail.skillLevel ?? skill.levels.length - 1, 0, skill.levels.length - 1);
  return skill.levels[idx];
}

function write(root, key, value) {
  root.querySelectorAll(`[data-bind="${key}"]`).forEach((el) => {
    el.textContent = value;
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function lookupBlackboard(bb, key) {
  let sign = 1;
  if (key.startsWith("-")) {
    sign = -1;
    key = key.slice(1);
  } else if (key.startsWith("+")) {
    key = key.slice(1);
  }
  const names = Object.keys(bb);
  const lower = Object.fromEntries(names.map((k) => [k.toLowerCase(), k]));
  const tryName = (name) => {
    if (name in bb) return bb[name];
    const hit = lower[name.toLowerCase()];
    return hit != null ? bb[hit] : undefined;
  };
  let val = tryName(key);
  if (val == null) val = tryName(key.replace(/_/g, "@"));
  if (val == null) val = tryName(key.replace(/@/g, "_"));
  if (val == null) {
    const needle = key.toLowerCase();
    const hit = names.find((k) => {
      const tail = k.split("@").pop().toLowerCase();
      return tail === needle || k.toLowerCase().endsWith("@" + needle);
    });
    if (hit != null) val = bb[hit];
  }
  if (typeof val === "number") return val * sign;
  return val;
}

function formatBlackboard(val, fmt) {
  if (typeof val === "string") return val;
  if (val == null) return "";
  if (!fmt) {
    return Number.isInteger(val) ? String(val) : String(Math.round(val * 1000) / 1000);
  }
  const percent = fmt.includes("%");
  const digits = (fmt.match(/\.(\d+)/) || [])[1];
  const n = percent ? val * 100 : val;
  let s = digits ? n.toFixed(Number(digits)) : String(Math.round(n));
  if (percent) s += "%";
  return s;
}

function formatDuration(d) {
  if (d == null) return "";
  if (d < 0) return "無限";
  if (d === 0) return "";
  return Number.isInteger(d) ? `${d}s` : `${d}s`;
}

function prtsWikiUrl(op) {
  const title = op.nameCn || op.name || op.id;
  return `https://prts.wiki/w/${encodeURIComponent(title)}`;
}

function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
