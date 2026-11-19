"""原始数据 → data/snapshot/*.parquet

    uv run python build.py

表：
    taxa     物种（植物 + 真菌），一行一种
    names    中文名：正名、别名
    dist     分布：TDWG 三级区，原生 / 引入
    uses     用途记录，逐条带文献
    flags    用途标记（有记载即标记，不代表安全）
    parts    按部位的记录：能不能吃、用途、备注
    hazards  毒性记录
    traits   真菌形态
    images   图片：文件名、作者、许可（先运行 images.py）
    sources  数据源

安全等级的合并规则见 docs/product.md「安全表达」：取最严；有食用记录不等于可食；未知按不可食。
"""

from __future__ import annotations

import collections
import csv
import difflib
import json
import re
import tempfile
import unicodedata
from pathlib import Path
from urllib.parse import quote, unquote

import duckdb
import openpyxl
from opencc import OpenCC

import more_images
import vocab
from sources import SOURCES

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "snapshot"

_cc = OpenCC("t2s")
CJK = re.compile(r"[㐀-鿿]")
ASCII_ALNUM = re.compile(r"[A-Za-z0-9]")
CN_AREAS = tuple(vocab.REGIONS)


def t2s(s: str) -> str:
    return _cc.convert(s)


def clean_zh(s: str | None) -> str | None:
    """清洗一个中文名；不像中文名的返回 None。"""
    if not s:
        return None
    s = t2s(unicodedata.normalize("NFKC", str(s))).strip()
    s = re.sub(r"[（(【\[].*?[）)】\]]", "", s)  # 去掉括注：（原变种）、(植物)
    s = re.sub(r"[\s　·•,，;；、。.]+", "", s)
    if not s or not CJK.search(s) or ASCII_ALNUM.search(s) or len(s) > 10:
        return None
    return s


def binomial(s: str | None) -> str | None:
    """带命名人、杂交号、种下等级的学名 → 'Genus epithet'。"""
    if not s:
        return None
    s = str(s).replace("\xa0", " ").replace("×", " ").replace("_", " ")
    toks = [t for t in re.split(r"\s+", s.strip()) if t and t.lower() != "x"]
    if len(toks) < 2:
        return None
    g, e = toks[0], toks[1]
    if not re.fullmatch(r"[A-Za-z][a-zA-Z-]+", g) or not re.fullmatch(r"[a-z][a-z-]+", e):
        return None
    if e in {"sp", "spp", "var", "subsp", "cf", "aff", "ssp"}:
        return None
    return f"{g.capitalize()} {e}"


def slug(name: str) -> str:
    s = name.replace("×", "x").replace("+", "")
    return re.sub(r"[^A-Za-z0-9_-]", "", re.sub(r"\s+", "_", s.strip()))


def sparql_tsv(name: str) -> list[list[str]]:
    """读 QLever / WDQS 的 TSV，把 "值"@lang、<uri> 还原成纯文本。"""

    def cell(c: str) -> str:
        if c.startswith("<") and c.endswith(">"):
            return c[1:-1]
        if c.startswith('"'):
            c = c[1 : c.rindex('"')]
            return c.replace('\\"', '"').replace("\\t", " ").replace("\\n", " ").replace("\\\\", "\\")
        return c

    with open(RAW / f"{name}.tsv", encoding="utf-8") as f:
        rows = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    return [[cell(c) for c in r] for r in rows[1:]]


def qid(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def xlsx_rows(file: str, sheet: str | int = 0) -> list[tuple]:
    wb = openpyxl.load_workbook(RAW / file, read_only=True)
    ws = wb[sheet] if isinstance(sheet, str) else wb.worksheets[sheet]
    return list(ws.iter_rows(values_only=True))


def norm_ref(s: str | None, limit: int = 400) -> str | None:
    if not s:
        return None
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s[:limit] or None


LABEL_PRIORITY = {"zh-cn": 0, "zh-hans": 1, "zh": 2, "zh-sg": 3, "zh-my": 3, "zh-hant": 5, "zh-tw": 5, "zh-hk": 6, "zh-mo": 6}


class Build:
    def __init__(self) -> None:
        self.con = duckdb.connect()
        self.tmp = Path(tempfile.mkdtemp(prefix="bcy-"))
        # taxon_id → 记录
        self.taxa: dict[str, dict] = {}
        self.sp2id: dict[str, str] = {}  # WCVP plant_name_id → taxon_id
        # taxon_id → [(优先级, 名称, 来源)]
        self.name_cands: dict[str, list[tuple[int, str, str]]] = collections.defaultdict(list)
        self.dist: list[dict] = []
        self.uses: list[dict] = []
        self.flags: list[dict] = []
        self.parts: list[dict] = []
        self.hazards: list[dict] = []
        self.traits: list[dict] = []
        self.images: list[dict] = []
        self._binom_cache: dict[str, str | None] = {}

    # ── WCVP：学名骨架 ───────────────────────────────────────────────
    def load_wcvp(self) -> None:
        con = self.con
        con.execute(f"""
            create table wn as
            select plant_name_id, ipni_id, taxon_rank, taxon_status, family, genus, species,
                   species_hybrid, genus_hybrid, taxon_name, taxon_authors, accepted_plant_name_id,
                   powo_id, lifeform_description, climate_description
            from read_csv('{RAW}/wcvp/wcvp_names.csv', delim='|', quote='', header=true, all_varchar=true)
            where genus is not null
        """)
        con.execute("""
            create table acc as
            select * from wn where taxon_rank = 'Species' and taxon_status = 'Accepted' and species is not null
            qualify row_number() over (partition by genus, species order by species_hybrid nulls first, plant_name_id) = 1
        """)
        # 任意名称（含异名、种下等级）→ 所属的接受种
        con.execute("""
            create table id2sp as
            select n.plant_name_id, s.plant_name_id as sp_id
            from wn n
            join wn a on a.plant_name_id = coalesce(n.accepted_plant_name_id, n.plant_name_id) and a.taxon_status = 'Accepted'
            join acc s on s.genus = a.genus and s.species = a.species
        """)
        con.execute("""
            create table binom as
            select n.genus || ' ' || n.species as b, i.sp_id,
                   min(case n.taxon_status when 'Accepted' then 0 when 'Synonym' then 1 else 2 end) as pri
            from wn n join id2sp i using (plant_name_id)
            where n.taxon_rank = 'Species' and n.species is not null
            group by all
        """)
        areas = ",".join(f"'{a}'" for a in CN_AREAS)
        con.execute(f"""
            create table cn_dist as
            select i.sp_id, d.area_code_l3 as area, min(d.introduced) as introduced
            from read_csv('{RAW}/wcvp/wcvp_distribution.csv', delim='|', quote='', header=true, all_varchar=true) d
            join id2sp i using (plant_name_id)
            where d.area_code_l3 in ({areas}) and d.extinct = '0' and d.location_doubtful = '0'
            group by all
        """)
        con.execute("create table scope as select distinct sp_id from cn_dist")
        print("WCVP 中国物种", con.sql("select count(*) from scope").fetchall()[0][0])

    def resolve(self, names: set[str]) -> dict[str, str]:
        """二名法学名 → WCVP 接受种的 plant_name_id。有歧义时优先取中国有分布的。"""
        todo = [n for n in names if n and n not in self._binom_cache]
        if todo:
            p = self.tmp / "q.csv"
            with open(p, "w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["b"])
                w.writerows([n] for n in todo)
            rows = self.con.execute(f"""
                select q.b, m.sp_id, m.pri, (s.sp_id is not null) as in_cn
                from read_csv('{p}', header=true, all_varchar=true) q
                join binom m using (b) left join scope s on s.sp_id = m.sp_id
            """).fetchall()
            by: dict[str, list] = collections.defaultdict(list)
            for b, sp, pri, in_cn in rows:
                by[b].append((pri, not in_cn, sp))
            for n in todo:
                c = sorted(by.get(n, []))
                if not c:
                    self._binom_cache[n] = None
                elif len(c) == 1 or c[0][:2] != c[1][:2]:
                    self._binom_cache[n] = c[0][2]
                else:
                    self._binom_cache[n] = None  # 同级别的多个候选，放弃
        return {n: v for n in names if (v := self._binom_cache.get(n))}

    def add_plants(self, sp_ids: set[str]) -> None:
        """把接受种加入物种表（已有的跳过）。"""
        new = [s for s in sp_ids if s not in self.sp2id]
        if not new:
            return
        p = self.tmp / "ids.csv"
        p.write_text("sp_id\n" + "\n".join(new))
        rows = self.con.execute(f"""
            select a.plant_name_id, a.taxon_name, a.taxon_authors, a.family, a.genus, a.powo_id,
                   a.lifeform_description, a.climate_description
            from acc a join read_csv('{p}', header=true, all_varchar=true) q on q.sp_id = a.plant_name_id
        """).fetchall()
        for sp, name, authors, family, genus, powo, lf, cl in rows:
            tid = slug(name)
            if tid in self.taxa:
                continue
            self.sp2id[sp] = tid
            self.taxa[tid] = {
                "id": tid, "kingdom": "plant", "sci": name, "authors": authors, "family": family,
                "genus": genus, "powo_id": powo, "lifeform": vocab.lifeform_zh(lf),
                "climate": vocab.CLIMATE.get(cl or "", cl), "in_china": False, "native_cn": False,
            }

    def plant_ids(self, names) -> dict[str, str]:
        """原始学名 → taxon_id；只返回已在物种表里的。"""
        b = {n: binomial(n) for n in names}
        r = self.resolve({v for v in b.values() if v})
        return {n: self.sp2id[r[v]] for n, v in b.items() if v and v in r and r[v] in self.sp2id}

    # ── 范围：中国有分布的 + 中文来源提到的 ──────────────────────────
    def build_scope(self) -> None:
        self.add_plants({r[0] for r in self.con.sql("select sp_id from scope").fetchall()})
        for sp, area, introduced in self.con.sql("select * from cn_dist").fetchall():
            tid = self.sp2id.get(sp)
            if not tid:
                continue
            t = self.taxa[tid]
            t["in_china"] = True
            native = introduced == "0"
            t["native_cn"] = t["native_cn"] or native
            self.dist.append({"taxon_id": tid, "area": area, "status": "native" if native else "introduced", "source": "wcvp"})
        # 中文来源提到、但 WCVP 没有记录中国分布的（多为栽培作物）
        extra: set[str] = set()
        for r in xlsx_rows("cn_useful_plants.xlsx", "数据发布内容")[1:]:
            extra.add(binomial(r[6]) or binomial(r[2]) or "")
        for r in self.tw_fda_rows():
            extra.update(binomial(n) or "" for n in r["sci"])
        for r in xlsx_rows("xsbn_plants.xlsx", 1)[1:]:
            extra.add(binomial(r[1]) or "")
        before = len(self.taxa)
        self.add_plants(set(self.resolve(extra - {""}).values()))
        print(f"物种表：中国分布 {before}，中文来源补充 {len(self.taxa) - before}")

    # ── 中文名 ───────────────────────────────────────────────────────
    def cand(self, tid: str, pri: int, name: str | None, source: str) -> None:
        n = clean_zh(name)
        if n:
            self.name_cands[tid].append((pri, n, source))

    def load_wikidata_plants(self) -> None:
        powo2pid = dict(self.con.sql("select powo_id, plant_name_id from wn where powo_id is not null").fetchall())
        pid2sp = dict(self.con.sql("select plant_name_id, sp_id from id2sp").fetchall())

        def locate(powo_urn: str) -> tuple[str | None, bool]:
            pid = powo2pid.get(powo_urn.rsplit(":", 1)[-1])
            sp = pid2sp.get(pid) if pid else None
            tid = self.sp2id.get(sp) if sp else None
            return tid, pid == sp

        for item, powo, lang, label in sparql_tsv("wd_plant_label"):
            tid, main = locate(powo)
            if tid:
                if main:
                    self.taxa[tid]["wikidata"] = qid(item)
                self.cand(tid, LABEL_PRIORITY.get(lang, 6) + (0 if main else 40), label, "wikidata")
        for item, powo, title in sparql_tsv("wd_plant_zhwiki"):
            tid, main = locate(powo)
            if tid and main:
                self.taxa[tid]["zhwiki"] = title
                self.taxa[tid]["wikidata"] = qid(item)
                self.cand(tid, 4, title, "wikidata")
        for item, powo, lang, name in sparql_tsv("wd_plant_common"):
            tid, main = locate(powo)
            if tid:
                self.cand(tid, 30 if main else 45, name, "wikidata")
        imgs: dict[str, list[str]] = collections.defaultdict(list)
        for item, powo, image in sparql_tsv("wd_plant_image"):
            tid, main = locate(powo)
            if tid and main:
                self.taxa[tid].setdefault("wikidata", qid(item))
                imgs[tid].append(unquote(image.rsplit("/", 1)[-1]))
        for tid, files in imgs.items():
            self.images.append({"taxon_id": tid, "file": sorted(files)[0], "source": "commons"})

    def load_taicol(self) -> None:
        self.taicol_rank: dict[tuple[str, str], str] = {}
        self.taicol_fungi: dict[str, tuple[str, str | None]] = {}
        with open(RAW / "taicol" / "TaiCOL_taxon_20261030.csv", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        plants = [r for r in rows if r["kingdom"] == "Plantae" and r["rank"] in {"Species", "Subspecies", "Variety", "Form"}]
        ids = self.plant_ids({r["simple_name"] for r in plants})
        for r in rows:
            if r["family"] and r["family_c"]:
                self.taicol_rank.setdefault(("family", r["family"]), t2s(r["family_c"]))
            if r["genus"] and r["genus_c"]:
                self.taicol_rank.setdefault(("genus", r["genus"]), t2s(r["genus_c"]))
            if r["kingdom"] == "Fungi" and r["rank"] == "Species" and r["common_name_c"]:
                self.taicol_fungi[r["simple_name"]] = (r["common_name_c"], r["alternative_name_c"])
        for r in plants:
            tid = ids.get(r["simple_name"])
            if not tid:
                continue
            species_level = r["rank"] == "Species"
            self.cand(tid, 8 if species_level else 50, r["common_name_c"], "taicol")
            for alt in re.split(r"[,，;；、]", r["alternative_name_c"] or ""):
                self.cand(tid, 35 if species_level else 50, alt, "taicol")

    # ── 用途：中国有用植物数据集 ─────────────────────────────────────
    def load_cn_useful(self) -> None:
        rows = xlsx_rows("cn_useful_plants.xlsx", "数据发布内容")[1:]
        ids = self.plant_ids({r[6] or r[2] for r in rows if r[6] or r[2]})
        seen: set[tuple] = set()
        name_count: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
        for _id, cn, latin, usage, cat, ref, verified, *_ in rows:
            tid = ids.get(verified or latin)
            cat = vocab.USE_CATEGORY.get((cat or "").strip())
            if not tid or not cat:
                continue
            text = re.sub(r"\s+", " ", str(usage or "")).strip()
            if text.lower() in vocab.GENERIC_USE_TEXT or text == cat or text.startswith("="):
                text = ""
            ref = norm_ref(ref)
            key = (tid, cat, text, ref)
            if key not in seen:
                seen.add(key)
                self.uses.append({"taxon_id": tid, "category": cat, "text": text or None, "reference": ref, "source": "cn_useful"})
            # 药用记录里的中文名多是药材名（如"木棉根"），不当作植物名
            if cat != "药用" and (n := clean_zh(cn)):
                name_count[tid][n] += 1
        for tid, c in name_count.items():
            for i, (n, _) in enumerate(c.most_common()):
                self.cand(tid, 10 if i == 0 else 36, n, "cn_useful")
        for tid, cat in {(u["taxon_id"], u["category"]) for u in self.uses}:
            self.flags.append({"taxon_id": tid, "flag": cat, "source": "cn_useful", "reference": None})

    # ── 食用标记：WCFP ───────────────────────────────────────────────
    def load_wcfp(self) -> None:
        rows = xlsx_rows("wcfp/WCFP.xlsx", "WCFP")
        h = {k: i for i, k in enumerate(rows[0])}
        ipni2pid = dict(self.con.sql("select ipni_id, plant_name_id from wn where ipni_id is not null").fetchall())
        pid2sp = dict(self.con.sql("select plant_name_id, sp_id from id2sp").fetchall())
        n = 0
        for r in rows[1:]:
            pid = ipni2pid.get(str(r[h["LSID_accepted"]]))
            tid = self.sp2id.get(pid2sp.get(pid, "")) if pid else None
            if not tid:
                continue
            n += 1
            t = self.taxa[tid]
            t["cultivated"] = t.get("cultivated") or str(r[h["cultivated_GRIN"]]) == "1"
            t["redlist"] = t.get("redlist") or r[h["red_list_category_code"]]
            for col, zh in vocab.WCFP_FLAGS.items():
                if str(r[h[col]]) == "1":
                    ref = norm_ref(r[h["references_food"]], 600) if col == "human_food" else None
                    self.flags.append({"taxon_id": tid, "flag": zh, "source": "wcfp", "reference": ref})
        print("WCFP 匹配", n)

    # ── 监管口径的可食部位：台湾食药署 ───────────────────────────────
    def tw_fda_rows(self) -> list[dict]:
        if hasattr(self, "_tw"):
            return self._tw
        out = []
        with open(RAW / "tw_fda_food_ingredients.csv", encoding="utf-8-sig") as f:
            for r in list(csv.reader(f))[1:]:
                _, cat, sub, zh, _en, sci, part, note = r[:8]
                out.append({
                    "allowed": cat.startswith("可供食品使用"),
                    "sub": sub,
                    "zh": [z for z in re.split(r"[；;]", zh) if z.strip()],
                    "sci": [s.strip() for s in re.split(r"[,，\n;；]", sci) if s.strip()],
                    "part": t2s(part).strip() or None,
                    "note": t2s(re.sub(r"\s+", " ", note)).strip() or None,
                })
        self._tw = out
        return out

    def load_tw_fda(self) -> None:
        rows = self.tw_fda_rows()
        ids = self.plant_ids({s for r in rows for s in r["sci"]})
        fungi = {t["sci"]: tid for tid, t in self.taxa.items() if t["kingdom"] == "fungus"}
        n = 0
        for r in rows:
            tids = list(dict.fromkeys(
                tid for s in r["sci"] if (tid := ids.get(s) or fungi.get(binomial(s) or ""))
            ))
            if not tids:
                continue
            n += 1
            if len(tids) == 1:
                for z in r["zh"]:
                    self.cand(tids[0], 37, z, "tw_fda")
            sub = vocab.TW_FDA_SUBCAT.get(r["sub"])
            for tid in tids:
                if r["allowed"]:
                    self.parts.append({
                        "taxon_id": tid, "part": r["part"], "verdict": "food_record",
                        "use": "食品原料" + (f"（{sub}）" if sub else ""),
                        "note": r["note"], "source": "tw_fda", "reference": "可供食品使用之原料",
                    })
                else:
                    self.parts.append({
                        "taxon_id": tid, "part": r["part"], "verdict": "restricted", "use": None,
                        "note": r["note"] or "未确认食用安全性前，不得作为食品原料使用。",
                        "source": "tw_fda", "reference": "未确认安全性尚不得使用之原料",
                    })
        print("台湾食药署 匹配行", n)

    # ── 毒性：TPPT ───────────────────────────────────────────────────
    def load_tppt(self) -> None:
        rows = xlsx_rows("tppt.xlsx", "Plants")
        h = {k: i for i, k in enumerate(rows[0])}
        rel = xlsx_rows("tppt.xlsx", "Relationships")[1:]
        toxins: dict[str, list[str]] = collections.defaultdict(list)
        for _n, _tn, toxin, plant_no, *_ in rel:
            if toxin and toxin not in toxins[plant_no]:
                toxins[plant_no].append(toxin)
        ids = self.plant_ids({r[h["Latin_plant_name"]] for r in rows[1:]})
        n = 0
        for r in rows[1:]:
            tid = ids.get(r[h["Latin_plant_name"]])
            human = (r[h["Human_toxicity"]] or "").strip()
            if not tid or not human:
                continue
            wild_only = "(only wild growing plants)" in human
            human = human.replace(" (only wild growing plants)", "")
            level, labels = None, []
            for piece in human.split(", "):
                lv, zh = vocab.TPPT_HUMAN.get(piece, (None, None))
                if zh:
                    labels.append(zh)
                if lv and vocab.LEVELS[lv] > vocab.LEVELS.get(level or "unknown", 0):
                    level = lv
            if not labels:
                continue
            part, note = vocab.tppt_part_zh(r[h["Toxic_plant_part"]])
            notes = [x for x in [note, "仅野生植株" if wild_only else None] if x]
            tox = toxins.get(r[h["Plant_number"]], [])
            self.hazards.append({
                "taxon_id": tid, "level": level, "part": part, "label": "、".join(labels),
                "note": "；".join(notes) or None,
                "toxins": "; ".join(tox[:12]) + (f" 等 {len(tox)} 种" if len(tox) > 12 else "") if tox else None,
                "source": "tppt", "reference": None,
            })
            n += 1
        print("TPPT 匹配", n)

    # ── 毒性：中国有毒植物参考种（1997）──────────────────────────────
    def load_cn_toxic(self, primary: dict[str, str], aliases: dict[str, set[str]]) -> None:
        by_name: dict[str, set[str]] = collections.defaultdict(set)
        for tid, n in primary.items():
            by_name[n].add(tid)
        for tid, ns in aliases.items():
            for n in ns:
                by_name[n].add(tid)
        last_genus, n, total = "", 0, 0
        for (line,) in xlsx_rows("cn_toxic_plants_1997.xlsx", "有毒植物"):
            if not line:
                continue
            m = re.match(r"^\s*([㐀-鿿]+)\s*(.*)$", str(line))
            if not m:
                continue
            zh, latin = t2s(m.group(1)), m.group(2).strip()
            if zh.endswith("科") and len(latin.split()) <= 1:
                last_genus = ""
                continue
            total += 1
            g = re.match(r"([A-Za-z]+)\s*([.．]?)\s*([a-z-]+)?", latin)
            if not g:
                continue
            abbreviated = bool(g.group(2)) or len(g.group(1)) <= 2
            genus = last_genus if abbreviated else g.group(1).capitalize()
            if not abbreviated:
                last_genus = genus
            epithet = g.group(3) or ""
            # 这份名录由图书识别而来，拉丁名错字多。
            # 1) 拉丁名能在 WCVP 里直接对上（含异名）的，直接采用；
            # 2) 否则以中文名找候选，再用种加词核对（属的归并不影响种加词）。
            pick: list[str] = []
            if genus and epithet:
                pick = list(self.plant_ids({f"{genus} {epithet}"}).values())
            if not pick and epithet:
                def similar(tid: str) -> bool:
                    e = self.taxa[tid]["sci"].split()[-1]
                    return difflib.SequenceMatcher(None, e[:-2], epithet[:-2]).ratio() >= 0.75
                cands = [t for t in by_name.get(zh, ()) if self.taxa[t]["kingdom"] == "plant" and similar(t)]
                exact = [t for t in cands if primary.get(t) == zh]
                pick = exact if len(exact) == 1 else cands
            if len(pick) != 1:
                continue
            n += 1
            self.hazards.append({
                "taxon_id": pick[0], "level": "toxic", "part": None, "label": "有毒",
                "note": "未注明有毒部位与毒性强弱", "toxins": None,
                "source": "cn_toxic_1997", "reference": f"原文：{re.sub(r'\\s+', ' ', str(line)).strip()}",
            })
        print(f"中国有毒植物参考种 匹配 {n}/{total}")

    # ── 真菌：Wikidata ───────────────────────────────────────────────
    def load_fungi(self) -> None:
        items: dict[str, dict] = {}
        for item, name, rank, edib, family, genus, order, if_id in sparql_tsv("wd_fungus"):
            if rank not in {"species", "variety", "form"}:
                continue
            d = items.setdefault(qid(item), {"sci": name, "edib": set()})
            d["edib"].add(qid(edib))
            for k, v in (("family", family), ("genus", genus), ("order", order), ("if_id", if_id)):
                if v and not d.get(k):
                    d[k] = v
        cands: dict[str, list] = collections.defaultdict(list)
        for item, lang, label in sparql_tsv("wd_fungus_label"):
            cands[qid(item)].append((LABEL_PRIORITY.get(lang, 6), label))
        zhwiki = {qid(i): t for i, t in sparql_tsv("wd_fungus_zhwiki")}
        for q, t in zhwiki.items():
            cands[q].append((4, t))
        for item, lang, name in sparql_tsv("wd_fungus_common"):
            cands[qid(item)].append((30, name))
        images: dict[str, list[str]] = collections.defaultdict(list)
        for item, image in sparql_tsv("wd_fungus_image"):
            images[qid(item)].append(unquote(image.rsplit("/", 1)[-1]))
        traits: dict[str, list] = collections.defaultdict(list)
        for item, prop, value in sparql_tsv("wd_fungus_morph"):
            traits[qid(item)].append((qid(prop), qid(value)))

        n = 0
        for q, d in items.items():
            tw = self.taicol_fungi.get(d["sci"])
            if tw:
                cands[q].append((8, tw[0]))
                cands[q] += [(35, a) for a in re.split(r"[,，;；、]", tw[1] or "")]
            if not any(clean_zh(c[1]) for c in cands[q]):
                continue  # 没有中文名的真菌先不收
            tid = slug(d["sci"])
            if tid in self.taxa:
                continue
            genus = d.get("genus") or d["sci"].split()[0]
            self.taxa[tid] = {
                "id": tid, "kingdom": "fungus", "sci": d["sci"], "authors": None, "family": d.get("family"),
                "genus": genus, "order": d.get("order"), "wikidata": q, "zhwiki": zhwiki.get(q),
                "in_china": False, "native_cn": False,
            }
            n += 1
            for pri, name in cands[q]:
                self.cand(tid, pri, name, "taicol" if pri in (8, 35) else "wikidata")
            if images.get(q):
                self.images.append({"taxon_id": tid, "file": sorted(images[q])[0], "source": "commons"})
            for prop, value in traits.get(q, []):
                zh = vocab.FUNGUS_VALUE.get(value)
                if zh and prop in vocab.FUNGUS_TRAIT:
                    self.traits.append({"taxon_id": tid, "trait": vocab.FUNGUS_TRAIT[prop], "value": zh, "source": "wikidata"})
            for e in sorted(d["edib"]):
                level, zh = vocab.FUNGUS_EDIBILITY.get(e, (None, None))
                if not zh:
                    continue
                if level in ("toxic", "deadly"):
                    self.hazards.append({
                        "taxon_id": tid, "level": level, "part": "子实体", "label": zh, "note": None,
                        "toxins": None, "source": "wikidata", "reference": "Wikidata P789（蘑菇可食性）",
                    })
                else:
                    self.parts.append({
                        "taxon_id": tid, "part": "子实体", "verdict": level or "unknown", "use": zh,
                        "note": None, "source": "wikidata", "reference": "Wikidata P789（蘑菇可食性）",
                    })
                    if level == "food_record":
                        self.flags.append({"taxon_id": tid, "flag": "食用", "source": "wikidata", "reference": None})
                    elif zh == "药用":
                        self.flags.append({"taxon_id": tid, "flag": "药用", "source": "wikidata", "reference": None})
        print("真菌（有可食性声明且有中文名）", n)

    # ── 科、属的中文名 ───────────────────────────────────────────────
    def rank_names(self, primary: dict[str, str]) -> None:
        cands: dict[tuple[str, str], collections.Counter] = collections.defaultdict(collections.Counter)
        ranks = {"Q35409": ("family", "科"), "Q34740": ("genus", "属")}
        for name, rank, lang, label in sparql_tsv("wd_rank_label"):
            kind, suffix = ranks[qid(rank)]
            zh = clean_zh(label)
            if zh and zh.endswith(suffix):
                cands[(kind, name)][zh] += 10 - LABEL_PRIORITY.get(lang, 6)
        # 同名异物（如 Pieris 既是马醉木属也是粉蝶属）：取与属内物种中文名最像的那个
        genus_species: dict[str, list[str]] = collections.defaultdict(list)
        for tid, zh in primary.items():
            genus_species[self.taxa[tid]["genus"]].append(zh)

        def pick(kind: str, name: str) -> str | None:
            c = cands.get((kind, name))
            tw = self.taicol_rank.get((kind, name))
            if not c:
                return tw
            if len(c) == 1:
                return next(iter(c))
            if kind == "genus":
                def score(label: str) -> int:
                    stem = label[:-1]
                    return sum(1 for s in genus_species.get(name, []) if stem[-2:] in s or stem[:2] in s)
                best = sorted(c, key=lambda x: (-score(x), -c[x]))
                if score(best[0]) > 0:
                    return best[0]
            if tw in c:
                return tw
            return c.most_common(1)[0][0]

        for t in self.taxa.values():
            t["family_zh"] = pick("family", t["family"]) if t.get("family") else None
            t["genus_zh"] = pick("genus", t["genus"]) if t.get("genus") else None

    # ── 名称定稿 ─────────────────────────────────────────────────────
    def finalize_names(self) -> tuple[dict[str, str], dict[str, set[str]], list[dict]]:
        primary: dict[str, str] = {}
        for tid, c in self.name_cands.items():
            best = min(c, key=lambda x: x[0])
            if best[0] < 40:  # 只有异名条目上的名称时，不设正名
                primary[tid] = best[1]
        owners: dict[str, set[str]] = collections.defaultdict(set)
        for tid, n in primary.items():
            owners[n].add(tid)
        rows, aliases = [], collections.defaultdict(set)
        dropped = 0
        for tid, c in self.name_cands.items():
            p = primary.get(tid)
            if p:
                src = min((x for x in c if x[1] == p), key=lambda x: x[0])[2]
                rows.append({"taxon_id": tid, "name": p, "kind": "primary", "source": src})
            seen = {p}
            for _pri, n, src in sorted(c):
                if n in seen:
                    continue
                seen.add(n)
                # 别名与另一个物种的正名相同：多半是错配（韭菜条目下的"薤白"），去掉
                if owners.get(n, set()) - {tid}:
                    dropped += 1
                    continue
                aliases[tid].add(n)
                rows.append({"taxon_id": tid, "name": n, "kind": "alias", "source": src})
        print(f"中文名：正名 {len(primary)}，别名 {sum(len(a) for a in aliases.values())}，去掉与他种正名相同的别名 {dropped}")
        return primary, aliases, rows

    # ── 兜底：名称提示有毒 ───────────────────────────────────────────
    def suspect_by_name(self, name_rows: list[dict]) -> None:
        """开放数据里的中国有毒植物记录很不全（钩吻就没有毒性记录）。
        中文名或别名里带"毒""断肠"等字样的，标为"可能有毒"，不让页面只显示"有食用记录"。
        "解毒草""败毒散"这类说的是功效，不算。"""
        pat = re.compile(r"断肠|见血封喉|(?<![解消败拔清排祛退攻散化治去疗敌肿])毒(?!消|散$)")
        has_grade = {h["taxon_id"] for h in self.hazards if h["level"]}
        hit: dict[str, dict] = {}
        for r in name_rows:
            if r["taxon_id"] not in has_grade and r["taxon_id"] not in hit and pat.search(r["name"]):
                hit[r["taxon_id"]] = r
        for tid, r in hit.items():
            self.hazards.append({
                "taxon_id": tid, "level": "suspect", "part": None, "label": "名称提示有毒",
                "note": f"{'中文名' if r['kind'] == 'primary' else '别名'}「{r['name']}」",
                "toxins": None, "source": r["source"], "reference": None,
            })
        print("名称提示有毒", len(hit))

    # ── 图片：作者与许可 ─────────────────────────────────────────────
    def license_images(self) -> None:
        """只保留开放许可、且查得到作者的图片（公有领域的可以没有作者）。"""
        meta_file, label_file = RAW / "commons_meta.json", RAW / "commons_labels.json"
        # 候选清单留给 images.py 查作者与许可
        (RAW / "image_candidates.json").write_text(json.dumps(sorted({i["file"] for i in self.images}), ensure_ascii=False))
        if not meta_file.exists():
            print("图片：没有 commons_meta.json（运行 images.py 后再构建一次），本次不带图片")
            self.images = []
            return
        meta = json.loads(meta_file.read_text())
        labels = json.loads(label_file.read_text()) if label_file.exists() else {}
        kept = []
        for img in self.images:
            m = meta.get(img["file"]) or {}
            lic = labels.get(m.get("license", ""), {})
            name = lic.get("spdx") or lic.get("label") or ""
            public_domain = m.get("status") == "Q19652" or name.startswith("CC0") or "public domain" in name.lower()
            open_cc = bool(re.match(r"^(CC-BY(-SA)?-\d|CC0|Creative Commons (Attribution|CC0|Zero))", name)) and not re.search(r"NC|ND|NonCommercial|NoDeriv", name)
            # 许可和"公有领域"状态对不上的（如标了 GFDL 又标公有领域）、说法含糊的，都不收
            if name and not open_cc and not (name.startswith("CC0") or "public domain" in name.lower()):
                continue
            if not (public_domain or open_cc):
                continue
            author = m.get("author") or labels.get(m.get("creator", ""), {}).get("label")
            if not author and not public_domain:
                continue
            short = re.sub(r"^CC-?(BY(?:-SA)?|0)-", lambda x: "CC0 " if x.group(1) == "0" else f"CC {x.group(1)} ", name) if lic.get("spdx") else name
            if public_domain and not open_cc and not name.startswith("CC0"):
                short = "公有领域"
            url = lic.get("url")
            if not url and (cc := re.match(r"^CC-(BY(?:-SA)?)-(\d\.\d)", name)):
                url = f"https://creativecommons.org/licenses/{cc.group(1).lower()}/{cc.group(2)}/"
            kept.append({**img, "author": re.sub(r"\s+", " ", author or "佚名")[:80], "license": short, "license_url": url})
        print(f"图片：{len(self.images)} 张里 {len(kept)} 张有开放许可和作者")
        for img in kept:
            f = quote(img["file"], safe="")
            img["url"] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{f}?width=960"
            img["thumb"] = f"https://commons.wikimedia.org/wiki/Special:FilePath/{f}?width=500"
            img["page"] = f"https://commons.wikimedia.org/wiki/File:{f}"
        self.images = kept

    def inat_images(self) -> None:
        """没有 Commons 配图的物种，用 iNaturalist 上开放许可的物种照片补。图片只记链接，不转存。"""
        taxa_file, photo_file = RAW / "inat_taxa.csv.gz", RAW / "inat_photos.json"
        if not taxa_file.exists():
            print("iNaturalist：没有 inat_taxa.csv.gz，跳过")
            return
        rows = self.con.sql(f"""
            select taxon_id, name, ancestry like '48460/47170/%' as fungus
            from read_csv('{taxa_file}', delim='\t', header=true, all_varchar=true)
            where rank = 'species' and active = 'true'
              and (ancestry like '48460/47126/%' or ancestry like '48460/47170/%')
        """).fetchall()
        plants = self.plant_ids({name for _, name, fungus in rows if not fungus})
        match: dict[str, tuple] = {}
        for inat_id, name, fungus in rows:
            tid = slug(name) if fungus else plants.get(name)
            t = self.taxa.get(tid) if tid else None
            if not t or (t["kingdom"] == "fungus") != fungus:
                continue
            # 同一个接受种对上多个 iNaturalist 物种（异名）时，取学名一致的
            key = (name != t["sci"], int(inat_id))
            if tid not in match or key < match[tid][0]:
                match[tid] = (key, inat_id)
        cand = {tid: m[1] for tid, m in sorted(match.items())}
        # 候选清单留给 inat.py 取照片
        (RAW / "inat_candidates.json").write_text(json.dumps(cand))
        if not photo_file.exists():
            print(f"iNaturalist：对上 {len(cand)} 种；没有 inat_photos.json（运行 inat.py 后再构建一次）")
            return
        photos = json.loads(photo_file.read_text())
        have = {i["taxon_id"] for i in self.images}
        n = 0
        for tid, inat_id in cand.items():
            ps = photos.get(inat_id)
            if tid in have or not ps:
                continue
            p = ps[0]
            name, url = vocab.INAT_LICENSE[p["license"]]
            base = f"https://inaturalist-open-data.s3.amazonaws.com/photos/{p['id']}"
            self.images.append({
                "taxon_id": tid, "file": None, "author": re.sub(r"\s+", " ", p["author"])[:80], "license": name,
                "license_url": url, "source": "inat", "url": f"{base}/large.{p['ext']}",
                "thumb": f"{base}/medium.{p['ext']}", "page": f"https://www.inaturalist.org/photos/{p['id']}",
            })
            n += 1
        print(f"iNaturalist：对上 {len(cand)} 种，补了 {n} 张图；共 {len(self.images)} 种有图")

    def more_images(self) -> None:
        """还没有图的物种，用 more_images.py 查到的图补：Commons 接口查到作者的配图、iNaturalist 观察记录照片。"""
        extra = more_images.rows({i["taxon_id"] for i in self.images})
        self.images += extra
        print(f"补图：{len(extra)} 张；共 {len({i['taxon_id'] for i in self.images})} 种有图")

    # ── 安全等级 ─────────────────────────────────────────────────────
    def grade(self) -> None:
        level: dict[str, str] = collections.defaultdict(lambda: "unknown")

        def bump(tid: str, lv: str | None) -> None:
            if lv and vocab.LEVELS[lv] > vocab.LEVELS[level[tid]]:
                level[tid] = lv

        for f in self.flags:
            if f["flag"] == "食用":
                bump(f["taxon_id"], "food_record")
        for p in self.parts:
            bump(p["taxon_id"], p["verdict"])
        for h in self.hazards:
            bump(h["taxon_id"], h["level"])
        for tid, t in self.taxa.items():
            t["safety"] = level[tid]

    # ── 输出 ─────────────────────────────────────────────────────────
    def table(self, name: str, rows: list[dict], columns: dict[str, str], order: str) -> None:
        p = self.tmp / f"{name}.ndjson"
        with open(p, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps({k: r.get(k) for k in columns}, ensure_ascii=False) + "\n")
        cols = ", ".join(f"'{k}': '{v}'" for k, v in columns.items())
        self.con.execute(f"create or replace table {name} as select * from read_json('{p}', format='newline_delimited', columns={{{cols}}}) order by {order}, {", ".join(f'"{c}"' for c in columns)}")
        self.con.execute(f"copy {name} to '{OUT}/{name}.parquet' (format parquet, compression snappy)")
        size = (OUT / f"{name}.parquet").stat().st_size
        print(f"  {name:8s} {len(rows):>7,d} 行  {size / 1e6:5.2f} MB")

    def run(self) -> None:
        OUT.mkdir(parents=True, exist_ok=True)
        self.load_wcvp()
        self.build_scope()
        self.load_taicol()
        self.load_wikidata_plants()
        self.load_fungi()
        self.load_cn_useful()
        self.load_wcfp()
        self.load_tw_fda()
        self.load_tppt()
        primary, aliases, name_rows = self.finalize_names()
        self.load_cn_toxic(primary, aliases)
        self.suspect_by_name(name_rows)
        self.rank_names(primary)
        self.license_images()
        self.inat_images()
        self.more_images()
        self.grade()
        for tid, t in self.taxa.items():
            t["zh"] = primary.get(tid)

        V, B = "VARCHAR", "BOOLEAN"
        print("输出")
        self.table("taxa", list(self.taxa.values()), {
            "id": V, "kingdom": V, "sci": V, "authors": V, "zh": V, "family": V, "family_zh": V,
            "genus": V, "genus_zh": V, "order": V, "lifeform": V, "climate": V, "in_china": B,
            "native_cn": B, "cultivated": B, "redlist": V, "safety": V, "powo_id": V, "wikidata": V,
            "zhwiki": V,
        }, "id")
        self.table("names", name_rows, {"taxon_id": V, "name": V, "kind": V, "source": V}, "taxon_id, kind desc, name")
        self.table("dist", self.dist, {"taxon_id": V, "area": V, "status": V, "source": V}, "taxon_id, area")
        self.table("uses", self.uses, {"taxon_id": V, "category": V, "text": V, "reference": V, "source": V}, "taxon_id, category, reference")
        self.table("flags", self.flags, {"taxon_id": V, "flag": V, "source": V, "reference": V}, "taxon_id, flag, source")
        self.table("parts", self.parts, {"taxon_id": V, "part": V, "verdict": V, "use": V, "note": V, "source": V, "reference": V}, "taxon_id, part")
        self.table("hazards", self.hazards, {"taxon_id": V, "level": V, "part": V, "label": V, "note": V, "toxins": V, "source": V, "reference": V}, "taxon_id, source")
        self.table("traits", self.traits, {"taxon_id": V, "trait": V, "value": V, "source": V}, "taxon_id, trait")
        self.table("images", self.images, {"taxon_id": V, "url": V, "thumb": V, "page": V, "file": V, "author": V, "license": V, "license_url": V, "source": V}, "taxon_id")
        self.table("sources", [s.__dict__ for s in SOURCES], {"id": V, "title": V, "license": V, "url": V, "version": V, "citation": V}, "id")

        con = self.con
        print("\n安全等级", con.sql("select kingdom, safety, count(*) from taxa group by all order by 1, 3 desc").fetchall())
        print("有中文名", con.sql("select kingdom, count(*) filter (zh is not null), count(*) from taxa group by all").fetchall())
        for probe in ("Portulaca_oleracea", "Gelsemium_elegans", "Solanum_lycopersicum", "Allium_tuberosum", "Amanita_exitialis", "Capsella_bursa-pastoris"):
            print(probe, con.sql(f"select zh, family_zh, genus_zh, lifeform, safety from taxa where id='{probe}'").fetchall(),
                  con.sql(f"select name from names where taxon_id='{probe}' and kind='alias'").fetchall()[:12])


if __name__ == "__main__":
    Build().run()
