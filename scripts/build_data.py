#!/usr/bin/env python3
"""Download (if needed) and compress Arknights operator data for the web app."""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
import urllib.request
from collections import defaultdict
from typing import Any

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "web", "data", "app-data.json")

SOURCES = {
    "character_table.json": "https://cdn.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/zh_CN/gamedata/excel/character_table.json",
    "range_table.json": "https://cdn.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/zh_CN/gamedata/excel/range_table.json",
    "uniequip_table.json": "https://cdn.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/zh_CN/gamedata/excel/uniequip_table.json",
    "skill_table.json": "https://cdn.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/zh_CN/gamedata/excel/skill_table.json",
    "character_table_tw.json": "https://cdn.jsdelivr.net/gh/ArknightsAssets/ArknightsGamedata@master/tw/gamedata/excel/character_table.json",
    "uniequip_table_tw.json": "https://cdn.jsdelivr.net/gh/ArknightsAssets/ArknightsGamedata@master/tw/gamedata/excel/uniequip_table.json",
    "skill_table_tw.json": "https://cdn.jsdelivr.net/gh/ArknightsAssets/ArknightsGamedata@master/tw/gamedata/excel/skill_table.json",
}

PROFESSIONS = [
    {"id": "PIONEER", "name": "先鋒"},
    {"id": "WARRIOR", "name": "近衛"},
    {"id": "TANK", "name": "重裝"},
    {"id": "SNIPER", "name": "狙擊"},
    {"id": "CASTER", "name": "術師"},
    {"id": "MEDIC", "name": "醫療"},
    {"id": "SUPPORT", "name": "輔助"},
    {"id": "SPECIAL", "name": "特種"},
]
PROF_IDS = {p["id"] for p in PROFESSIONS}

STAT_KEYS = (
    "maxHp",
    "atk",
    "def",
    "magicResistance",
    "cost",
    "blockCnt",
    "baseAttackTime",
    "respawnTime",
)

TAG_RE = re.compile(r"<[^>]+>")
NUM_RE = re.compile(r"\d+(?:\.\d+)?%?")
SPACE_RE = re.compile(r"\s+")
_CC = None

ATTR_MAP = {
    "MAX_HP": "hp",
    "ATK": "atk",
    "DEF": "def",
    "MAGIC_RESISTANCE": "res",
    "COST": "cost",
    "RESPAWN_TIME": "redeploy",
    "ATTACK_SPEED": "aspd",
    "BLOCK_CNT": "block",
}


def convert(text: str) -> str:
    global _CC
    if not text:
        return ""
    try:
        if _CC is None:
            from opencc import OpenCC

            _CC = OpenCC("s2twp")
        return _CC.convert(text)
    except Exception:
        return text


def phase_of(raw: Any) -> int:
    if raw is None:
        return 0
    if isinstance(raw, int):
        return raw
    text = str(raw)
    if text.endswith("2") or "PHASE_2" in text:
        return 2
    if text.endswith("1") or "PHASE_1" in text:
        return 1
    return 0


def strip_tags(text: str) -> str:
    if not text:
        return ""
    return SPACE_RE.sub(" ", TAG_RE.sub("", text)).strip()


def trait_shape(text: str) -> str:
    cleaned = strip_tags(text)
    cleaned = NUM_RE.sub("#", cleaned)
    return SPACE_RE.sub("", cleaned)


def rarity_of(raw: Any) -> int:
    if isinstance(raw, str) and raw.startswith("TIER_"):
        return int(raw.split("_")[1])
    if isinstance(raw, int):
        return raw + 1
    return 0


def damage_hint(trait: str) -> str:
    t = trait or ""
    if "元素" in t:
        return "元素"
    if "治療" in t or "恢復" in t or "回復" in t or "生命" in t and "不攻擊" in t:
        return "治療"
    if "法術" in t:
        return "法術"
    if "物理" in t:
        return "物理"
    if "不攻擊" in t or "不進行攻擊" in t:
        return "不攻擊"
    return "物理"


def download(url: str, dest: str) -> None:
    print(f"  download {os.path.basename(dest)}")
    req = urllib.request.Request(url, headers={"User-Agent": "ArkChassis/1.0"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=180) as resp:
        data = resp.read()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as fh:
        fh.write(data)


def ensure_raw() -> None:
    os.makedirs(RAW, exist_ok=True)
    for name, url in SOURCES.items():
        path = os.path.join(RAW, name)
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            continue
        download(url, path)


def load_json(name: str) -> Any:
    with open(os.path.join(RAW, name), encoding="utf-8") as fh:
        return json.load(fh)


def pick_stats(frame: dict[str, Any]) -> dict[str, float]:
    data = frame["data"]
    return {
        "hp": data["maxHp"],
        "atk": data["atk"],
        "def": data["def"],
        "res": data["magicResistance"],
        "cost": data["cost"],
        "block": data["blockCnt"],
        "interval": data["baseAttackTime"],
        "redeploy": data["respawnTime"],
    }


def lookup_bb(bb: dict[str, Any], key: str) -> Any:
    sign = 1
    if key.startswith("-"):
        sign = -1
        key = key[1:]
    elif key.startswith("+"):
        key = key[1:]
    lower = {k.lower(): k for k in bb}
    for cand in (key, key.replace("_", "@"), key.replace("@", "_")):
        if cand in bb:
            val = bb[cand]
            return val * sign if isinstance(val, (int, float)) else val
        hit = lower.get(cand.lower())
        if hit is not None:
            val = bb[hit]
            return val * sign if isinstance(val, (int, float)) else val
    needle = key.lower()
    for k, val in bb.items():
        tail = k.split("@")[-1].lower()
        if tail == needle or k.lower().endswith("@" + needle):
            return val * sign if isinstance(val, (int, float)) else val
    return None


def format_bb(val: Any, fmt: str | None) -> str:
    if isinstance(val, str):
        return val
    if val is None:
        return ""
    if not fmt:
        return str(int(val)) if float(val) == int(val) else str(val)
    percent = "%" in fmt
    digits = re.search(r"\.(\d+)", fmt)
    n = val * 100 if percent else val
    text = f"{n:.{digits.group(1)}f}" if digits else str(round(n))
    if percent:
        text += "%"
    return text


def fill_template(desc: str, blackboard: list | dict | None) -> str:
    bb = blackboard if isinstance(blackboard, dict) else pack_blackboard(blackboard)

    def repl(match: re.Match) -> str:
        val = lookup_bb(bb, match.group(1))
        if val is None:
            return ""
        return format_bb(val, match.group(2))

    text = re.sub(r"\{([^}:]+)(?::([^}]+))?\}", repl, desc or "")
    return SPACE_RE.sub(" ", TAG_RE.sub("", text)).strip()


def pack_trait(raw_trait: dict[str, Any] | None, tw_trait: dict[str, Any] | None, fallback: str) -> list[dict[str, Any]]:
    cands = (raw_trait or {}).get("candidates") or []
    tw_cands = (tw_trait or {}).get("candidates") or []
    out = []
    if not cands:
        if fallback:
            out.append({"elite": 0, "pot": 0, "desc": convert(fallback), "blackboard": {}})
        return out
    for i, cand in enumerate(cands):
        tw_c = tw_cands[i] if i < len(tw_cands) else {}
        desc = tw_c.get("overrideDescripton") or convert(cand.get("overrideDescripton") or fallback)
        out.append(
            {
                "elite": phase_of((cand.get("unlockCondition") or {}).get("phase")),
                "pot": cand.get("requiredPotentialRank") or 0,
                "desc": desc,
                "blackboard": pack_blackboard(cand.get("blackboard")),
            }
        )
    return out


def pack_blackboard(items: list[dict[str, Any]] | None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for item in items or []:
        key = item.get("key")
        if not key:
            continue
        if item.get("valueStr"):
            out[key] = item["valueStr"]
        else:
            out[key] = item.get("value")
    return out


def pack_skill(skill_id: str, cn_skills: dict[str, Any], tw_skills: dict[str, Any]) -> dict[str, Any] | None:
    raw = cn_skills.get(skill_id)
    if not raw:
        return None
    tw = tw_skills.get(skill_id) or {}
    tw_levels = tw.get("levels") or []
    levels = []
    for i, lv in enumerate(raw.get("levels") or []):
        tw_lv = tw_levels[i] if i < len(tw_levels) else {}
        sp = lv.get("spData") or {}
        levels.append(
            {
                "name": tw_lv.get("name") or convert(lv.get("name") or ""),
                "desc": tw_lv.get("description") or convert(lv.get("description") or ""),
                "rangeId": lv.get("rangeId"),
                "type": lv.get("skillType") or "MANUAL",
                "spType": str(sp.get("spType") or ""),
                "spCost": sp.get("spCost") or 0,
                "initSp": sp.get("initSp") or 0,
                "duration": lv.get("duration") if lv.get("duration") is not None else 0,
                "blackboard": pack_blackboard(lv.get("blackboard")),
            }
        )
    return {
        "id": skill_id,
        "icon": raw.get("iconId") or skill_id,
        "levels": levels,
    }


def pack_talents(raw_talents: list[dict[str, Any]] | None, tw_talents: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out = []
    tw_talents = tw_talents or []
    for i, talent in enumerate(raw_talents or []):
        tw_t = tw_talents[i] if i < len(tw_talents) else {}
        tw_cands = tw_t.get("candidates") or []
        entries = []
        for j, cand in enumerate(talent.get("candidates") or []):
            if cand.get("isHideTalent"):
                continue
            tw_c = tw_cands[j] if j < len(tw_cands) else {}
            entries.append(
                {
                    "elite": phase_of((cand.get("unlockCondition") or {}).get("phase")),
                    "pot": cand.get("requiredPotentialRank") or 0,
                    "name": tw_c.get("name") or convert(cand.get("name") or ""),
                    "desc": tw_c.get("description") or convert(cand.get("description") or ""),
                }
            )
        if entries:
            out.append({"entries": entries})
    return out


def pack_terms() -> dict[str, dict[str, str]]:
    """Combat terms (ba.*) for dossier tooltips. TW names first, else OpenCC."""
    cn_path = os.path.join(RAW, "gamedata_const.json")
    tw_path = os.path.join(RAW, "gamedata_const_tw.json")
    local = os.path.join(RAW, "term_table.json")
    cn_dict: dict[str, Any] = {}
    tw_dict: dict[str, Any] = {}
    if os.path.exists(cn_path):
        raw = load_json("gamedata_const.json")
        cn_dict = raw.get("termDescriptionDict") or {}
    if os.path.exists(tw_path):
        raw = load_json("gamedata_const_tw.json")
        tw_dict = raw.get("termDescriptionDict") or {}
    if os.path.exists(local):
        local_terms = load_json("term_table.json")
        for tid, info in local_terms.items():
            cn_dict.setdefault(tid, {"termName": info.get("name"), "description": info.get("desc")})
    out: dict[str, dict[str, str]] = {}
    for tid, info in cn_dict.items():
        if not str(tid).startswith("ba."):
            continue
        tw_info = tw_dict.get(tid) or {}
        name = tw_info.get("termName") or convert((info or {}).get("termName") or "")
        desc = tw_info.get("description") or convert((info or {}).get("description") or "")
        desc = TAG_RE.sub("", desc)
        desc = SPACE_RE.sub(" ", desc).strip()
        if name and desc:
            out[tid] = {"name": name, "desc": desc}
    return out


def pack_potentials(ranks: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out = []
    for rank in ranks or []:
        stats: dict[str, float] = {}
        buff = rank.get("buff") or {}
        mods = ((buff.get("attributes") or {}).get("attributeModifiers")) or []
        for mod in mods:
            key = ATTR_MAP.get(mod.get("attributeType") or "")
            if not key:
                continue
            stats[key] = stats.get(key, 0) + (mod.get("value") or 0)
        out.append({"desc": convert(rank.get("description") or ""), "stats": stats})
    return out


def build() -> dict[str, Any]:
    ensure_raw()
    cn_chars = load_json("character_table.json")
    tw_chars = load_json("character_table_tw.json")
    ranges = load_json("range_table.json")
    cn_equip = load_json("uniequip_table.json")
    tw_equip = load_json("uniequip_table_tw.json")
    cn_skills = load_json("skill_table.json")
    tw_skills = load_json("skill_table_tw.json")

    tw_sub = {
        sid: info.get("subProfessionName") or ""
        for sid, info in (tw_equip.get("subProfDict") or {}).items()
    }
    cn_sub = cn_equip.get("subProfDict") or {}

    range_out: dict[str, Any] = {}
    for rid, info in ranges.items():
        grids = [{"row": g["row"], "col": g["col"]} for g in info.get("grids") or []]
        range_out[rid] = {"id": rid, "grids": grids}

    operators: dict[str, Any] = {}
    for cid, raw in cn_chars.items():
        if raw.get("profession") not in PROF_IDS:
            continue
        if raw.get("isNotObtainable"):
            continue
        phases_raw = raw.get("phases") or []
        if not phases_raw:
            continue

        tw = tw_chars.get(cid) or {}
        name_cn = raw.get("name") or cid
        name = tw.get("name") or convert(name_cn)
        trait_cn = raw.get("description") or ""
        trait_entries = pack_trait(raw.get("trait"), tw.get("trait"), tw.get("description") or convert(trait_cn))
        last_trait = trait_entries[-1] if trait_entries else None
        trait = fill_template(last_trait["desc"], last_trait["blackboard"]) if last_trait else convert(strip_tags(trait_cn))

        phases = []
        for i, phase in enumerate(phases_raw):
            frames = phase.get("attributesKeyFrames") or []
            if len(frames) < 1:
                continue
            phases.append(
                {
                    "elite": i,
                    "rangeId": phase.get("rangeId") or "",
                    "maxLevel": phase.get("maxLevel") or frames[-1].get("level") or 1,
                    "min": pick_stats(frames[0]),
                    "max": pick_stats(frames[-1]),
                }
            )
        if not phases:
            continue

        trust = {"hp": 0, "atk": 0, "def": 0, "res": 0}
        favor = raw.get("favorKeyFrames") or []
        if favor:
            bonus = favor[-1]["data"]
            trust = {
                "hp": bonus.get("maxHp") or 0,
                "atk": bonus.get("atk") or 0,
                "def": bonus.get("def") or 0,
                "res": bonus.get("magicResistance") or 0,
            }

        last = phases[-1]
        skill_refs = []
        for slot in raw.get("skills") or []:
            sid = slot.get("skillId")
            if not sid:
                continue
            skill_refs.append(
                {
                    "id": sid,
                    "unlockElite": phase_of((slot.get("unlockCond") or {}).get("phase")),
                }
            )
        operators[cid] = {
            "id": cid,
            "name": name,
            "nameCn": name_cn,
            "nameEn": raw.get("appellation") or "",
            "rarity": rarity_of(raw.get("rarity")),
            "profession": raw["profession"],
            "branchId": raw.get("subProfessionId") or "unknown",
            "position": "近戰" if raw.get("position") == "MELEE" else "遠程",
            "trait": trait,
            "traitEntries": trait_entries,
            "traitShape": trait_shape(trait_cn),
            "maxElite": last["elite"],
            "maxPotential": (raw.get("maxPotentialLevel") or 0) + 1,
            "rangeId": last["rangeId"],
            "interval": last["max"]["interval"],
            "block": last["max"]["block"],
            "phases": phases,
            "trust": trust,
            "potentials": pack_potentials(raw.get("potentialRanks")),
            "talents": pack_talents(raw.get("talents"), tw.get("talents")),
            "skillRefs": skill_refs,
        }

    branches_map: dict[str, dict[str, Any]] = {}
    for cid, op in operators.items():
        bid = op["branchId"]
        if bid not in branches_map:
            cn_info = cn_sub.get(bid) or {}
            name = tw_sub.get(bid) or convert(cn_info.get("subProfessionName") or bid)
            branches_map[bid] = {
                "id": bid,
                "profession": op["profession"],
                "name": name,
                "order": cn_info.get("subProfessionCatagory") or 999,
                "groups": [],
            }

    grouped: dict[str, dict[tuple, list[str]]] = defaultdict(lambda: defaultdict(list))
    for cid, op in operators.items():
        key = (op["rangeId"], op["traitShape"], op["interval"], op["block"])
        grouped[op["branchId"]][key].append(cid)

    families = []
    for bid, branch in branches_map.items():
        groups_src = grouped[bid]
        packed = []
        for (range_id, shape, interval, block), ids in groups_src.items():
            ids.sort(
                key=lambda x: (
                    -operators[x]["rarity"],
                    -operators[x]["phases"][-1]["max"]["atk"],
                    operators[x]["name"],
                )
            )
            # majority range per elite
            range_by_elite: dict[int, str] = {}
            for elite in range(3):
                votes: dict[str, int] = defaultdict(int)
                for cid in ids:
                    phases = operators[cid]["phases"]
                    phase = phases[elite] if elite < len(phases) else phases[-1]
                    if phase["rangeId"]:
                        votes[phase["rangeId"]] += 1
                if votes:
                    range_by_elite[elite] = max(votes.items(), key=lambda kv: kv[1])[0]
            sample = operators[ids[0]]
            packed.append(
                {
                    "id": f"{bid}__{range_id}__{interval}__{block}",
                    "rangeId": range_id,
                    "rangeByElite": [range_by_elite.get(0, range_id), range_by_elite.get(1, range_id), range_by_elite.get(2, range_id)],
                    "trait": sample["trait"],
                    "interval": interval,
                    "block": block,
                    "position": sample["position"],
                    "damage": damage_hint(sample["trait"]),
                    "operatorIds": ids,
                    "count": len(ids),
                }
            )
        packed.sort(key=lambda g: (-g["count"], g["rangeId"]))
        seen_ids: set[str] = set()
        for g in packed:
            base = g["id"]
            if base in seen_ids:
                n = 2
                while f"{base}__x{n}" in seen_ids:
                    n += 1
                g["id"] = f"{base}__x{n}"
            seen_ids.add(g["id"])
        if packed:
            packed[0]["primary"] = True
        for extra in packed[1:]:
            extra["primary"] = False
            names = "、".join(operators[i]["name"] for i in extra["operatorIds"][:3])
            extra["label"] = f"特例 · {names}"
        if packed:
            packed[0]["label"] = "常見幹員" if len(packed) > 1 else "底盤"
        branch["groups"] = packed
        branch["count"] = sum(g["count"] for g in packed)
        families.append(branch)

    families.sort(key=lambda b: (next(i for i, p in enumerate(PROFESSIONS) if p["id"] == b["profession"]), b["order"], b["name"]))

    used_skills: dict[str, Any] = {}
    used_ranges = set()
    for op in operators.values():
        for phase in op["phases"]:
            if phase["rangeId"]:
                used_ranges.add(phase["rangeId"])
        for ref in op.get("skillRefs") or []:
            sid = ref["id"]
            if sid in used_skills:
                continue
            packed = pack_skill(sid, cn_skills, tw_skills)
            if packed:
                used_skills[sid] = packed
                for lv in packed["levels"]:
                    if lv.get("rangeId"):
                        used_ranges.add(lv["rangeId"])
    range_out = {rid: range_out[rid] for rid in used_ranges if rid in range_out}

    return {
        "professions": PROFESSIONS,
        "ranges": range_out,
        "branches": families,
        "operators": operators,
        "skills": used_skills,
        "terms": pack_terms(),
    }


def main() -> int:
    print("Building operator dataset…")
    data = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print(
        f"Wrote {OUT} ({size:,} bytes) — "
        f"{len(data['operators'])} operators, "
        f"{len(data['branches'])} branches, "
        f"{len(data['skills'])} skills, "
        f"{len(data['ranges'])} ranges, "
        f"{len(data.get('terms') or {})} terms"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
