import { createDetailState, renderOperator, syncDetail } from "./detail.js";
import {
  PROF_ORDER,
  applyTrust,
  baseStatsAt,
  branchOf,
  imgEl,
  profIconEl,
  profName,
  renderRange,
  setAccent,
  stars,
  withDps,
} from "./shared.js";

const state = {
  data: null,
  prof: "ALL",
  elite: 2,
  levelMode: "max",
  trust: true,
  sort: { key: "rarity", dir: -1 },
  highlight: null,
  searchOpen: false,
  detail: null,
  returnHash: "#/",
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const searchInput = $("#search");
const searchPanel = $("#search-panel");

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === "o" && parts[1]) {
    return { view: "op", id: parts[1] };
  }
  if (parts[0] === "f" && parts[1]) {
    return { view: "family", branchId: parts[1], groupId: parts[2] || null, op: params.get("op") };
  }
  return { view: "home" };
}

function go(hash) {
  location.hash = hash;
}

function statsOf(op, elite, levelMode, trust) {
  const phase = op.phases[Math.min(elite, op.phases.length - 1)];
  const level = levelMode === "max" ? phase.maxLevel : 1;
  const out = applyTrust(baseStatsAt(phase, level), op.trust, trust ? 1 : 0);
  withDps(out);
  out.usedElite = phase.elite;
  return out;
}

function renderHome() {
  document.body.classList.remove("is-detail");
  const { branches, professions } = state.data;
  const shown = state.prof === "ALL" ? branches : branches.filter((b) => b.profession === state.prof);
  const byProf = new Map(PROF_ORDER.map((id) => [id, []]));
  for (const b of shown) byProf.get(b.profession)?.push(b);

  const frag = document.createDocumentFragment();
  const bar = document.createElement("div");
  bar.className = "prof-bar";
  bar.appendChild(pill("全部", state.prof === "ALL", () => {
    state.prof = "ALL";
    render();
  }));
  for (const p of professions) {
    const count = branches.filter((b) => b.profession === p.id).reduce((n, b) => n + b.count, 0);
    bar.appendChild(pill(p.name, state.prof === p.id, () => {
      state.prof = p.id;
      render();
    }, count, p.id));
  }
  frag.appendChild(bar);

  for (const p of professions) {
    const list = byProf.get(p.id) || [];
    if (!list.length) continue;
    const sec = document.createElement("section");
    sec.className = "sec";
    const heading = document.createElement("h2");
    heading.className = "sec-h";
    heading.append(
      profIconEl(p.id, "prof-ico"),
      document.createTextNode(p.name)
    );
    const countEl = document.createElement("span");
    countEl.className = "muted";
    countEl.textContent = String(list.reduce((n, b) => n + b.count, 0));
    heading.appendChild(countEl);
    sec.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const branch of list) grid.appendChild(branchCard(branch));
    sec.appendChild(grid);
    frag.appendChild(sec);
  }
  app.replaceChildren(frag);
}

function pill(label, on, fn, count, prof) {
  const btn = document.createElement("button");
  btn.className = "prof-btn" + (on ? " on" : "");
  btn.type = "button";
  if (prof) {
    setAccent(btn, prof);
    btn.appendChild(profIconEl(prof, "prof-ico"));
  }
  const name = document.createElement("span");
  name.textContent = label;
  btn.appendChild(name);
  if (count != null) {
    const small = document.createElement("small");
    small.textContent = String(count);
    btn.appendChild(small);
  }
  btn.addEventListener("click", fn);
  return btn;
}

function branchCard(branch) {
  const primary = branch.groups[0];
  const extras = branch.groups.length - 1;
  const btn = document.createElement("button");
  btn.className = "card";
  btn.type = "button";
  setAccent(btn, branch.profession);
  const top = document.createElement("div");
  top.className = "card-top";
  top.appendChild(renderRange(state.data, primary.rangeId, `var(--${branch.profession})`, 10));
  const count = document.createElement("div");
  count.className = "count";
  count.textContent = `${branch.count} 人`;
  top.appendChild(count);
  const title = document.createElement("h3");
  title.className = "card-title";
  title.append(profIconEl(branch.profession, "prof-ico"), document.createTextNode(branch.name));
  const trait = document.createElement("p");
  trait.className = "trait";
  trait.textContent = primary.trait;
  const faces = document.createElement("div");
  faces.className = "faces";
  const ids = branch.groups.flatMap((g) => g.operatorIds).slice(0, 8);
  for (const id of ids) faces.appendChild(imgEl(id));
  if (extras > 0) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${branch.groups.length} 組`;
    faces.appendChild(badge);
  }
  btn.append(top, title, trait, faces);
  btn.addEventListener("click", () => go(`#/f/${branch.id}`));
  return btn;
}

function renderFamily(route) {
  document.body.classList.remove("is-detail");
  const branch = branchOf(state.data, route.branchId);
  if (!branch) {
    app.innerHTML = `<p class="error">找不到這個分支。</p>`;
    return;
  }
  const group = branch.groups.find((g) => g.id === route.groupId) || branch.groups[0];
  const eliteCap = Math.max(...group.operatorIds.map((id) => state.data.operators[id].maxElite));
  const elite = Math.min(state.elite, eliteCap);
  const rangeId = group.rangeByElite[elite] || group.rangeId;

  const wrap = document.createElement("div");
  const back = document.createElement("button");
  back.className = "back";
  back.type = "button";
  back.textContent = "← 全部職業";
  back.addEventListener("click", () => {
    state.prof = branch.profession;
    go("#/");
  });

  const head = document.createElement("div");
  head.className = "family-head";
  const left = document.createElement("div");
  const crumb = document.createElement("div");
  crumb.className = "crumb";
  crumb.append(
    profIconEl(branch.profession, "prof-ico sm"),
    document.createTextNode(profName(state.data, branch.profession))
  );
  const title = document.createElement("h1");
  title.className = "family-title";
  title.append(profIconEl(branch.profession, "prof-ico lg"), document.createTextNode(branch.name));
  const traitP = document.createElement("p");
  traitP.className = "trait";
  traitP.textContent = group.trait;
  left.append(crumb, title, traitP);
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const text of [group.position, group.damage, `阻擋 ${group.block}`, `間隔 ${group.interval}s`]) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = text;
    chips.appendChild(chip);
  }
  left.appendChild(chips);

  const panel = document.createElement("div");
  panel.className = "range-panel";
  setAccent(panel, branch.profession);
  const tabs = document.createElement("div");
  tabs.className = "elite-tabs";
  for (let i = 0; i <= eliteCap; i += 1) {
    const t = document.createElement("button");
    t.className = "tab" + (i === elite ? " on" : "");
    t.type = "button";
    t.textContent = `精 ${i}`;
    t.addEventListener("click", () => {
      state.elite = i;
      render();
    });
    tabs.appendChild(t);
  }
  panel.append(tabs, renderRange(state.data, rangeId, `var(--${branch.profession})`, 26));
  head.append(left, panel);
  wrap.append(back, head);

  if (branch.groups.length > 1) {
    const gt = document.createElement("div");
    gt.className = "group-tabs";
    for (const g of branch.groups) {
      const b = document.createElement("button");
      b.className = "tab" + (g.id === group.id ? " on" : "");
      b.type = "button";
      b.textContent = `${g.label}（${g.count}）`;
      b.addEventListener("click", () => go(`#/f/${branch.id}/${g.id}`));
      gt.appendChild(b);
    }
    wrap.appendChild(gt);
  }

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.innerHTML = `<div class="left">數值基準</div>`;
  const right = document.createElement("div");
  right.className = "right";
  right.append(
    toggle("滿級", state.levelMode === "max", () => {
      state.levelMode = "max";
      render();
    }),
    toggle("1 級", state.levelMode === "min", () => {
      state.levelMode = "min";
      render();
    }),
    toggle("滿信賴", state.trust, () => {
      state.trust = !state.trust;
      render();
    })
  );
  toolbar.appendChild(right);
  wrap.appendChild(toolbar);
  const hint = document.createElement("p");
  hint.className = "note";
  hint.textContent = "點幹員名字可開啟檔案，同一頁調整精英化、等級、潛能、信賴與技能。";
  wrap.appendChild(hint);

  const rows = group.operatorIds.map((id) => {
    const op = state.data.operators[id];
    return { op, stats: statsOf(op, elite, state.levelMode, state.trust) };
  });
  rows.sort((a, b) => {
    const av = sortValue(a, state.sort.key);
    const bv = sortValue(b, state.sort.key);
    if (av < bv) return -1 * state.sort.dir;
    if (av > bv) return 1 * state.sort.dir;
    return a.op.name.localeCompare(b.op.name, "zh-Hant");
  });

  const extrema = {};
  for (const key of ["cost", "hp", "atk", "def", "interval", "dps", "redeploy"]) {
    const vals = rows.map((r) => r.stats[key]);
    extrema[key] = { max: Math.max(...vals), min: Math.min(...vals) };
  }

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";
  const table = document.createElement("table");
  const cols = [
    ["name", "幹員"],
    ["rarity", "星"],
    ["cost", "費用"],
    ["hp", "生命"],
    ["atk", "攻擊"],
    ["def", "防禦"],
    ["interval", "攻擊間隔(s)"],
    ["dps", "DPS"],
    ["redeploy", "再部署(s)"],
  ];
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  for (const [key, label] of cols) {
    const th = document.createElement("th");
    th.textContent = label + (state.sort.key === key ? (state.sort.dir > 0 ? " ↑" : " ↓") : "");
    th.addEventListener("click", () => {
      if (state.sort.key === key) state.sort.dir *= -1;
      else {
        state.sort.key = key;
        state.sort.dir = key === "name" ? 1 : -1;
      }
      render();
    });
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  const tbody = document.createElement("tbody");
  const familyHash = `#/f/${branch.id}${group.id !== branch.groups[0].id ? "/" + group.id : ""}`;
  for (const row of rows) {
    const tr = document.createElement("tr");
    if (state.highlight === row.op.id) tr.classList.add("flash");
    tr.dataset.id = row.op.id;
    const nameTd = document.createElement("td");
    const opBtn = document.createElement("button");
    opBtn.className = "op";
    opBtn.type = "button";
    opBtn.appendChild(imgEl(row.op.id));
    const who = document.createElement("span");
    who.className = "who";
    const extra = row.stats.usedElite < elite ? `最高精${row.stats.usedElite}` : row.op.nameEn;
    who.innerHTML = `<b>${row.op.name}</b><span>${extra}</span>`;
    opBtn.appendChild(who);
    opBtn.addEventListener("click", () => openOperator(row.op.id, familyHash));
    nameTd.appendChild(opBtn);
    tr.appendChild(nameTd);
    tr.appendChild(tdPlain(`<span class="stars">${stars(row.op.rarity)}</span>`));
    for (const key of ["cost", "hp", "atk", "def", "interval", "dps", "redeploy"]) {
      tr.appendChild(tdNum(row.stats[key], extrema[key], rows.length > 1));
    }
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  app.replaceChildren(wrap);
  if (state.highlight) {
    app.querySelector(`tr[data-id="${state.highlight}"]`)?.scrollIntoView({ block: "center" });
    setTimeout(() => {
      state.highlight = null;
    }, 1600);
  }
}

function openOperator(id, returnHash) {
  state.returnHash = returnHash || location.hash || "#/";
  go(`#/o/${id}`);
}

function showOperator(id) {
  const op = state.data.operators[id];
  if (!op) {
    document.body.classList.remove("is-detail");
    app.innerHTML = `<p class="error">找不到這名幹員。</p>`;
    return;
  }
  document.body.classList.add("is-detail");
  if (!state.detail || state.detail.id !== id) {
    state.detail = createDetailState(op);
  }
  const detail = state.detail;
  const handlers = {
    onBack: () => go(state.returnHash || "#/"),
    onElite: (elite) => {
      detail.elite = elite;
      syncDetail(app, state.data, op, detail);
    },
    onLevel: (level) => {
      detail.levelByElite[detail.elite] = level;
      syncDetail(app, state.data, op, detail);
    },
    onPotential: (n) => {
      detail.potential = n;
      const label = app.querySelector("[data-bind=potential-label]");
      if (label) label.textContent = n;
      syncDetail(app, state.data, op, detail);
    },
    onTrust: (n) => {
      detail.trust = n;
      syncDetail(app, state.data, op, detail);
    },
    onSkill: (i) => {
      detail.skillIndex = i;
      syncDetail(app, state.data, op, detail);
    },
  };
  renderOperator(app, state.data, op, detail, handlers);
}

function toggle(label, on, fn) {
  const b = document.createElement("button");
  b.className = "toggle" + (on ? " on" : "");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}

function tdPlain(html) {
  const td = document.createElement("td");
  td.innerHTML = html;
  return td;
}

function tdNum(value, ext, mark) {
  const td = document.createElement("td");
  td.className = "num";
  if (mark && ext.max !== ext.min) {
    if (value === ext.max) td.classList.add("max");
    if (value === ext.min) td.classList.add("min");
  }
  td.textContent = String(value);
  return td;
}

function sortValue(row, key) {
  if (key === "name") return row.op.name;
  if (key === "rarity") return row.op.rarity;
  return row.stats[key];
}

function searchItems(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const hits = [];
  for (const b of state.data.branches) {
    if (b.name.toLowerCase().includes(query) || b.id.includes(query)) {
      hits.push({ type: "branch", id: b.id, title: b.name, sub: profName(state.data, b.profession), avatar: b.groups[0].operatorIds[0], profession: b.profession });
    }
  }
  for (const op of Object.values(state.data.operators)) {
    const blob = `${op.name} ${op.nameCn} ${op.nameEn}`.toLowerCase();
    if (blob.includes(query)) {
      const branch = branchOf(state.data, op.branchId);
      hits.push({
        type: "op",
        id: op.id,
        title: op.name,
        sub: `${branch?.name || ""} · ${op.nameEn}`,
        avatar: op.id,
        branchId: op.branchId,
        profession: op.profession,
      });
    }
  }
  hits.sort((a, b) => Number(b.title.toLowerCase().startsWith(query)) - Number(a.title.toLowerCase().startsWith(query)));
  return hits.slice(0, 16);
}

function renderSearch(items) {
  if (!state.searchOpen) {
    searchPanel.hidden = true;
    return;
  }
  searchPanel.hidden = false;
  if (!items.length) {
    searchPanel.innerHTML = `<div class="search-empty">沒有符合的幹員或分支</div>`;
    return;
  }
  searchPanel.replaceChildren();
  items.forEach((item, i) => {
    const btn = document.createElement("button");
    btn.className = "search-item" + (i === 0 ? " active" : "");
    btn.type = "button";
    btn.appendChild(imgEl(item.avatar));
    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("b");
    if (item.profession) title.appendChild(profIconEl(item.profession, "prof-ico sm"));
    title.appendChild(document.createTextNode(item.title));
    const sub = document.createElement("span");
    sub.textContent = item.sub;
    meta.append(title, sub);
    btn.appendChild(meta);
    btn.addEventListener("click", () => pickSearch(item));
    searchPanel.appendChild(btn);
  });
}

function pickSearch(item) {
  searchInput.value = "";
  state.searchOpen = false;
  renderSearch([]);
  if (item.type === "branch") go(`#/f/${item.id}`);
  else {
    const branch = branchOf(state.data, item.branchId);
    const group = branch?.groups.find((g) => g.operatorIds.includes(item.id));
    const familyHash = `#/f/${item.branchId}${group && group !== branch.groups[0] ? "/" + group.id : ""}`;
    openOperator(item.id, familyHash);
  }
}

function render() {
  if (!state.data) return;
  const route = parseHash();
  if (route.view === "op") {
    showOperator(route.id);
    return;
  }
  if (route.view === "family") {
    if (state._lastBranch !== route.branchId) {
      state.elite = 2;
      state.sort = { key: "rarity", dir: -1 };
      state._lastBranch = route.branchId;
    }
    if (route.op) {
      state.highlight = route.op;
      const clean = `#/f/${route.branchId}${route.groupId ? "/" + route.groupId : ""}`;
      history.replaceState(null, "", clean);
    }
    renderFamily(route);
  } else {
    state._lastBranch = null;
    renderHome();
  }
}

searchInput.addEventListener("input", () => {
  state.searchOpen = true;
  renderSearch(searchItems(searchInput.value));
});
searchInput.addEventListener("focus", () => {
  if (searchInput.value.trim()) {
    state.searchOpen = true;
    renderSearch(searchItems(searchInput.value));
  }
});
searchInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    state.searchOpen = false;
    renderSearch([]);
    searchInput.blur();
  }
  if (ev.key === "Enter") {
    const first = searchItems(searchInput.value)[0];
    if (first) pickSearch(first);
  }
});
document.addEventListener("click", (ev) => {
  if (!ev.target.closest(".search-wrap")) {
    state.searchOpen = false;
    searchPanel.hidden = true;
  }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "/" && document.activeElement !== searchInput && ev.target.tagName !== "INPUT") {
    ev.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (ev.key === "Escape" && parseHash().view === "op" && document.activeElement !== searchInput) {
    go(state.returnHash || "#/");
  }
});
window.addEventListener("hashchange", render);

async function boot() {
  try {
    const res = await fetch("data/app-data.json");
    if (!res.ok) throw new Error(res.statusText);
    state.data = await res.json();
    render();
  } catch (err) {
    const file = location.protocol === "file:";
    app.innerHTML = file
      ? `<p class="error">瀏覽器不允許直接雙擊讀 JSON。請把 <code>web/</code> 放到 GitHub Pages，或雙擊 <code>啟動.bat</code> 本機預覽。<br>${err}</p>`
      : `<p class="error">讀不到 <code>data/app-data.json</code>。確認這個檔案和頁面在同一層靜態站裡。<br>${err}</p>`;
  }
}

boot();
