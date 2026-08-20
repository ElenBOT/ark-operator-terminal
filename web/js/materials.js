// Pure material-cost math for the leveling calculator. No DOM here.

function clampInt(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function addAll(counts, materials) {
  for (const m of materials || []) {
    counts[m.id] = (counts[m.id] || 0) + m.count;
  }
}

function levelRangeCost(data, phaseIdx, fromLevel, toLevel) {
  const expRow = (data.levelTable.expByPhase || [])[phaseIdx] || [];
  const lmdRow = (data.levelTable.lmdByPhase || [])[phaseIdx] || [];
  let exp = 0;
  let lmd = 0;
  for (let lv = fromLevel; lv < toLevel; lv += 1) {
    const e = expRow[lv - 1];
    const l = lmdRow[lv - 1];
    if (typeof e === "number" && e > 0) exp += e;
    if (typeof l === "number" && l > 0) lmd += l;
  }
  return { exp, lmd };
}

// Greedy largest-denomination-first EXP book breakdown. Not waste-optimal, just practical.
export function expItemsBreakdown(expItems, totalExp) {
  const out = {};
  let remaining = Math.ceil(totalExp);
  if (remaining <= 0) return out;
  const tiers = Object.entries(expItems || {})
    .map(([id, gain]) => ({ id, gain }))
    .filter((t) => t.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  for (const t of tiers) {
    if (remaining <= 0) break;
    const n = Math.floor(remaining / t.gain);
    if (n > 0) {
      out[t.id] = n;
      remaining -= n * t.gain;
    }
  }
  if (remaining > 0 && tiers.length) {
    const smallest = tiers[tiers.length - 1];
    out[smallest.id] = (out[smallest.id] || 0) + 1;
  }
  return out;
}

// current/target: { elite, level, skillLevelShared, mastery: number[] } | null
// Returns a plain { itemId: count } map — LMD (id "4001") and EXP books are folded
// in alongside ordinary materials so the UI only ever renders one list.
export function planMaterials(data, op, current, target) {
  const counts = {};
  if (!current || !target) return counts;

  let lmdTotal = 0;
  let expTotal = 0;
  const maxElite = op.maxElite ?? 0;
  const cElite = clampInt(current.elite, 0, maxElite);
  const tElite = clampInt(target.elite, 0, maxElite);

  for (let p = cElite + 1; p <= tElite; p += 1) {
    const cost = (op.evolveCost || [])[p - 1];
    if (cost) {
      addAll(counts, cost.materials);
      lmdTotal += cost.lmd || 0;
    }
  }

  for (let p = cElite; p <= tElite; p += 1) {
    const phase = op.phases[p];
    if (!phase) continue;
    const from = p === cElite ? clampInt(current.level, 1, phase.maxLevel) : 1;
    const to = p === tElite ? clampInt(target.level, 1, phase.maxLevel) : phase.maxLevel;
    if (to > from) {
      const { exp, lmd } = levelRangeCost(data, p, from, to);
      expTotal += exp;
      lmdTotal += lmd;
    }
  }

  const cSkill = clampInt(current.skillLevelShared, 1, 7);
  const tSkill = clampInt(target.skillLevelShared, 1, 7);
  for (let i = cSkill; i < tSkill; i += 1) {
    const cost = (op.skillLevelCost || [])[i - 1];
    if (cost) addAll(counts, cost.materials);
  }

  (op.skillRefs || []).forEach((ref, idx) => {
    const cMastery = clampInt((current.mastery || [])[idx] ?? 0, 0, 3);
    const tMastery = clampInt((target.mastery || [])[idx] ?? 0, 0, 3);
    for (let m = cMastery; m < tMastery; m += 1) {
      const cost = (ref.masteryCost || [])[m];
      if (cost) addAll(counts, cost.materials);
    }
  });

  if (lmdTotal > 0) counts["4001"] = (counts["4001"] || 0) + Math.round(lmdTotal);
  if (expTotal > 0) {
    for (const [id, n] of Object.entries(expItemsBreakdown(data.expItems, expTotal))) {
      counts[id] = (counts[id] || 0) + n;
    }
  }

  return counts;
}

// LMD and EXP books aren't part of a farm plan — LMD is unlimited-ish and EXP has
// its own dedicated stages the player already knows about.
const NON_FARMABLE_IDS = new Set(["4001", "2001", "2002", "2003", "2004"]);

// Expected sanity to obtain one unit of `id`, picking whichever of "farm at its
// best known stage" or "craft from its recipe" is cheaper — recursing into the
// recipe's own ingredients (memoized; a `seen` set per DFS branch guards cycles,
// which the real recipe graph shouldn't have, but the data is unverified enough
// to not trust that blindly). LMD/goldCost is deliberately excluded from the
// comparison per product decision — only sanity is optimized for.
function effectiveCosts(data, ids) {
  const memo = new Map();
  function resolve(id, seen) {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return { cost: Infinity, useCraft: false };
    seen.add(id);
    const mat = data.materials[id];
    const farmCost = mat?.drops?.[0]?.apPerItem ?? Infinity;
    let craftCost = Infinity;
    if (mat?.craft && mat.craft.costs?.length) {
      const perOutput = mat.craft.count || 1;
      let sum = 0;
      for (const c of mat.craft.costs) sum += resolve(c.id, seen).cost * c.count;
      craftCost = sum / perOutput;
    }
    const useCraft = craftCost < farmCost;
    const result = { cost: useCraft ? craftCost : farmCost, useCraft };
    memo.set(id, result);
    return result;
  }
  for (const id of ids) resolve(id, new Set());
  return memo;
}

// Greedy weighted set-cover: repeatedly pick whichever candidate stage yields the
// most still-needed material per sanity spent, run it enough times to clear
// whichever material it's the bottleneck for, and let any other materials it
// also drops ride along for free. Not a proven-optimal solve (that's a proper
// LP problem), but it's stage-overlap-aware and explainable, which a pure
// per-material "just pick your own best stage" recommendation would not be.
function greedyStageCover(data, farmDemand) {
  const remaining = { ...farmDemand };
  const stages = [];
  const activeIds = () => Object.keys(remaining).filter((id) => remaining[id] > 0);
  let guard = 0;
  while (activeIds().length && guard < 200) {
    guard += 1;
    const candidates = new Map();
    for (const id of activeIds()) {
      for (const d of data.materials[id]?.drops || []) {
        if (!d.apCost || !d.apPerItem) continue;
        let entry = candidates.get(d.stageId);
        if (!entry) {
          entry = { stageId: d.stageId, code: d.code, name: d.name, apCost: d.apCost, perRun: {} };
          candidates.set(d.stageId, entry);
        }
        entry.perRun[id] = d.apCost / d.apPerItem;
      }
    }
    let best = null;
    let bestScore = 0;
    for (const entry of candidates.values()) {
      let usefulPerRun = 0;
      for (const [id, qtyPerRun] of Object.entries(entry.perRun)) {
        usefulPerRun += Math.min(qtyPerRun, remaining[id] || 0);
      }
      const score = usefulPerRun / entry.apCost;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    if (!best) break;
    let runs = 1;
    for (const [id, qtyPerRun] of Object.entries(best.perRun)) {
      if (remaining[id] > 0 && qtyPerRun > 0) runs = Math.max(runs, Math.ceil(remaining[id] / qtyPerRun));
    }
    const covers = [];
    for (const [id, qtyPerRun] of Object.entries(best.perRun)) {
      if (remaining[id] > 0) {
        const gained = Math.round(runs * qtyPerRun * 100) / 100;
        covers.push({ id, gained });
        remaining[id] = Math.max(0, remaining[id] - gained);
      }
    }
    stages.push({ stageId: best.stageId, code: best.code, name: best.name, apCost: best.apCost, runs, sanity: runs * best.apCost, covers });
  }
  const unresolved = activeIds().map((id) => ({ id, count: remaining[id] }));
  return { stages, unresolved };
}

// Turns a `planMaterials` result (minus LMD/EXP) into a recommended plan: which
// materials to craft (and how many times), and which stages to farm for
// everything left over, aware that one stage clear can satisfy several
// materials' demand at once.
export function planFarmStrategy(data, counts) {
  const needed = Object.entries(counts).filter(([id, n]) => n > 0 && !NON_FARMABLE_IDS.has(id));
  const costs = effectiveCosts(
    data,
    needed.map(([id]) => id)
  );
  const farmDemand = {};
  const craftTimes = {};
  const unresolved = [];
  const queue = needed.map(([id, count]) => ({ id, count }));
  let guard = 0;
  while (queue.length && guard < 5000) {
    guard += 1;
    const { id, count } = queue.shift();
    if (count <= 0) continue;
    const info = costs.get(id) ?? effectiveCosts(data, [id]).get(id);
    const mat = data.materials[id];
    if (!info || info.cost === Infinity) {
      unresolved.push({ id, count });
      continue;
    }
    if (info.useCraft && mat.craft) {
      const perOutput = mat.craft.count || 1;
      const times = Math.ceil(count / perOutput);
      craftTimes[id] = (craftTimes[id] || 0) + times;
      for (const c of mat.craft.costs) queue.push({ id: c.id, count: c.count * times });
    } else {
      farmDemand[id] = (farmDemand[id] || 0) + count;
    }
  }
  const craftSteps = Object.entries(craftTimes).map(([id, times]) => ({
    id,
    times,
    perOutput: data.materials[id]?.craft?.count || 1,
    costs: data.materials[id]?.craft?.costs || [],
  }));
  const { stages, unresolved: stageUnresolved } = greedyStageCover(data, farmDemand);
  return { craftSteps, stages, unresolved: [...unresolved, ...stageUnresolved] };
}
