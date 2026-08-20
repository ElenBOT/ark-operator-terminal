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
