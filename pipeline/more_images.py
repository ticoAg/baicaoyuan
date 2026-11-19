"""给还没有图的物种补图。

    uv run python more_images.py

按顺序试两个来源，每个物种取到一张就停：

1. Wikidata 的配图（P18）。build.py 靠 Commons 的结构化数据查作者，很多老图没有这项，整张被丢掉
   （番茄就是这样）。这里改用 Commons 接口的 extmetadata 取作者与许可。
2. iNaturalist 观察记录里的照片，取得票最多的研究级记录。inat.py 只取物种页上的几张代表照片，
   它们常是 NC 许可；观察记录里另有大量 CC0、CC BY、CC BY-SA 的照片。
   逐个物种问 iNaturalist 要两万多次请求（每分钟限 60 次），所以先用 GBIF 的分面一次列出
   带这类照片的全部种名，只问名单上的。名单按记录原文的学名，异名会漏掉一小部分。

查询结果缓存在 data/raw/more_images.json（查过没有的也记下，下次不再问），
然后直接补进 data/snapshot/images.parquet，不必重跑整条管线。build.py 也读这份缓存，重新构建时不会丢。
只收 CC0、公有领域、CC BY、CC BY-SA，且查得到作者的（公有领域的可以没有作者）。全量约四十分钟。
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote, unquote

import duckdb
import requests

import vocab

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
SNAP = ROOT / "data" / "snapshot"
CACHE = RAW / "more_images.json"
UA = {"User-Agent": "baicaoyuan-pipeline/0.1 (https://github.com/ticoAg/baicaoyuan)"}
WIKIDATA = "https://qlever.dev/api/wikidata"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
GBIF = "https://api.gbif.org/v1/occurrence/search"
INAT_DATASET = "50c9509d-22c7-4a22-a47d-8c48425ef4a7"  # iNaturalist research-grade observations
KINGDOM = {"plant": 6, "fungus": 5}  # GBIF 骨干分类的界
INAT_OBS = "https://api.inaturalist.org/v1/observations"
INAT_SQUARE = re.compile(r"^https://inaturalist-open-data\.s3\.amazonaws\.com/photos/(\d+)/square\.(\w+)$")
ICONIC = {"plant": "Plantae", "fungus": "Fungi"}
COLUMNS = ["taxon_id", "url", "thumb", "page", "file", "author", "license", "license_url", "source"]


def call(method: str, url: str, **kw) -> requests.Response:
    """限流（429）或服务端出错时等一等再试。"""
    headers = {**UA, **kw.pop("headers", {})}
    for attempt in range(8):
        try:
            r = requests.request(method, url, headers=headers, timeout=180, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                wait = r.headers.get("Retry-After", "")
                wait = min(max(int(wait) if wait.isdigit() else 0, 15 * (attempt + 1)), 180)
                print(f"  {r.status_code}，{wait} 秒后重试", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            print(f"  请求失败，重试：{e}")
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(f"接口连续失败：{url}")


# ── 1. Commons ───────────────────────────────────────────────────────
def p18(qids: list[str]) -> dict[str, list[str]]:
    """Wikidata 实体 → 配图文件名。"""
    out: dict[str, list[str]] = {}
    for n in range(0, len(qids), 300):
        vals = " ".join(f"<http://www.wikidata.org/entity/{q}>" for q in qids[n : n + 300])
        query = f"SELECT ?i ?img WHERE {{ VALUES ?i {{ {vals} }} ?i <http://www.wikidata.org/prop/direct/P18> ?img }}"
        r = call("POST", WIKIDATA, data={"query": query}, headers={"Accept": "application/sparql-results+json"})
        for b in r.json()["results"]["bindings"]:
            q = b["i"]["value"].rsplit("/", 1)[1]
            out.setdefault(q, []).append(unquote(b["img"]["value"].rsplit("/", 1)[1]))
        time.sleep(3)
    return out


def plain(s: str | None) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).strip()


def commons_license(meta: dict) -> dict | None:
    """extmetadata → 作者与许可；不是开放许可、或缺作者的返回 None。"""
    v = lambda k: plain((meta.get(k) or {}).get("value"))
    short, code, url = v("LicenseShortName"), v("License").lower(), v("LicenseUrl")
    if re.search(r"\b(NC|ND)\b|noncommercial|noderiv", f"{short} {code}", re.I):
        return None
    if re.match(r"^CC BY(-SA)? \d", short):
        name = short
    elif short.startswith("CC0") or code.startswith("cc0"):
        name, url = "CC0 1.0", url or "https://creativecommons.org/publicdomain/zero/1.0/"
    elif code.startswith("pd") or short.lower().startswith("public domain"):
        name, url = "公有领域", None
    else:
        return None
    author = clean_author(v("Artist"))
    if not author:
        if name != "公有领域" and not name.startswith("CC0"):
            return None
        author = "佚名"
    return {"author": author, "license": name, "license_url": url or None}


def clean_author(s: str) -> str:
    """Commons 的 Artist 字段是自由填写的 HTML：去掉常见的套话、链接，太长的在逗号处截断。查不到作者返回空串。"""
    s = re.sub(r"https?://\S+", "", s)
    if m := re.search(r"No machine-readable author provided\. (.+?) assumed", s):
        s = m.group(1)
    elif m := re.search(r"created by user (.+?) at Mushroom Observer", s):
        s = f"{m.group(1)}, Mushroom Observer"
    elif m := re.search(r"(?i)original uploader was (.+?) at ", s):
        s = m.group(1)
    s = re.sub(r"\(licensed under\s*\)", "", re.sub(r"^User:", "", s)).strip(" .,;:-")
    s = re.sub(r"\s+", " ", s)
    if re.fullmatch(r"(?i)((anonymous|unknown|author|see below)\s*)*", s):
        return ""
    if len(s) > 80:
        cut = s[:80].rsplit(",", 1)[0] if "," in s[:80] else s[:80].rsplit(" ", 1)[0]
        s = f"{cut.strip()} 等"
    return s


def commons(files: list[str]) -> dict[str, dict | None]:
    """文件名 → 作者与许可。Commons 接口一次最多 50 个文件。"""
    out: dict[str, dict | None] = {}
    for n in range(0, len(files), 50):
        batch = files[n : n + 50]
        r = call("GET", COMMONS_API, params={
            "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "extmetadata",
            "iiextmetadatafilter": "Artist|LicenseShortName|License|LicenseUrl",
            "titles": "|".join(f"File:{f}" for f in batch), "maxlag": 5,
        })
        q = r.json().get("query", {})
        norm = {x["to"]: x["from"] for x in q.get("normalized", [])}
        for page in q.get("pages", {}).values():
            title = norm.get(page["title"], page["title"])
            info = (page.get("imageinfo") or [{}])[0].get("extmetadata") or {}
            out[title.removeprefix("File:")] = commons_license(info) if info else None
        for f in batch:
            out.setdefault(f, None)
        time.sleep(1)
    return out


# ── 2. iNaturalist 观察记录 ─────────────────────────────────────────
INAT_QUERY = {"datasetKey": INAT_DATASET, "mediaType": "StillImage", "license": ["CC0_1_0", "CC_BY_4_0"]}


def photographed(kingdom: str) -> set[str]:
    """GBIF 收录的 iNaturalist 记录里，带 CC0 或 CC BY 照片的种名（二名，小写）。
    逐个物种去 iNaturalist 问要两万多次请求；先用 GBIF 的分面一次列出所有种名，只问名单上的。"""
    names, off = set(), 0
    while True:
        r = call("GET", GBIF, params={**INAT_QUERY, "kingdomKey": KINGDOM[kingdom], "limit": 0,
                                      "facet": "VERBATIM_SCIENTIFIC_NAME", "facetLimit": 50000, "facetOffset": off})
        facets = r.json().get("facets") or [{"counts": []}]
        counts = facets[0]["counts"]
        names |= {" ".join(c["name"].split()[:2]) for c in counts}
        if len(counts) < 50000:
            return names
        off += 50000
        time.sleep(2)


def obs_photo(sci: str, kingdom: str) -> dict | None:
    """这个种得票最多的研究级观察记录里，第一张开放许可的照片。"""
    r = call("GET", INAT_OBS, params={
        "taxon_name": sci, "iconic_taxa": ICONIC[kingdom], "quality_grade": "research",
        "photo_license": "cc0,cc-by,cc-by-sa", "order_by": "votes", "per_page": 10,
    })
    time.sleep(1.1)  # 接口建议每分钟不超过 60 次
    for o in r.json().get("results", []):
        name = (o.get("taxon") or {}).get("name") or ""
        if name != sci and not name.startswith(sci + " "):  # 学名对不上的（异名归并、鉴定到别的种）不收
            continue
        user = o.get("user") or {}
        author = (user.get("name") or user.get("login") or "").strip()
        for p in o.get("photos", []):
            hit = INAT_SQUARE.match(p.get("url") or "")
            code = p.get("license_code")
            if hit and code in vocab.INAT_LICENSE and not p.get("flags") and (author or code == "cc0"):
                return {"id": int(hit.group(1)), "ext": hit.group(2), "license": code, "author": author or "佚名"}
    return None


# ── 缓存 → 图片行 ────────────────────────────────────────────────────
def load() -> dict:
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    cache.setdefault("commons", {})
    cache.setdefault("obs", cache.pop("gbif", {}))  # 早先经 GBIF 逐个查的结果，格式相同
    return cache


def rows(have: set[str]) -> list[dict]:
    """缓存里查到的图，给 have 以外的物种，一种一张。build.py 也调用这里。"""
    cache, out = load(), []
    for tid in sorted(set(cache["commons"]) | set(cache["obs"])):
        if tid in have:
            continue
        if c := cache["commons"].get(tid):
            f = quote(c["file"], safe="")
            out.append({
                "taxon_id": tid, "file": c["file"], "author": c["author"], "license": c["license"], "license_url": c["license_url"],
                "source": "commons", "url": f"https://commons.wikimedia.org/wiki/Special:FilePath/{f}?width=960",
                "thumb": f"https://commons.wikimedia.org/wiki/Special:FilePath/{f}?width=500",
                "page": f"https://commons.wikimedia.org/wiki/File:{f}",
            })
        elif g := cache["obs"].get(tid):
            name, url = vocab.INAT_LICENSE[g["license"]]
            base = f"https://inaturalist-open-data.s3.amazonaws.com/photos/{g['id']}"
            out.append({
                "taxon_id": tid, "file": None, "author": re.sub(r"\s+", " ", g["author"])[:80], "license": name, "license_url": url,
                "source": "inat", "url": f"{base}/large.{g['ext']}", "thumb": f"{base}/medium.{g['ext']}",
                "page": f"https://www.inaturalist.org/photos/{g['id']}",
            })
    return out


def main() -> None:
    con = duckdb.connect()
    taxa = con.sql(f"select id, sci, kingdom, wikidata from '{SNAP}/taxa.parquet'").fetchall()
    have = {r[0] for r in con.sql(f"select taxon_id from '{SNAP}/images.parquet'").fetchall()}
    cache = load()
    save = lambda: CACHE.write_text(json.dumps(cache, ensure_ascii=False))
    RAW.mkdir(parents=True, exist_ok=True)
    todo = [t for t in taxa if t[0] not in have]
    print(f"{len(taxa)} 种里 {len(todo)} 种没有图")

    # 1. Commons
    ask = [t for t in todo if t[3] and t[0] not in cache["commons"]]
    if ask:
        files = p18(sorted({t[3] for t in ask}))
        metas = commons(sorted({f for fs in files.values() for f in fs}))
        for tid, _sci, _k, q in ask:
            ok = [f for f in sorted(files.get(q, [])) if metas.get(f)]
            cache["commons"][tid] = {"file": ok[0], **metas[ok[0]]} if ok else None
        save()
    found = {tid for tid, c in cache["commons"].items() if c}
    print(f"Commons：查了 {len(ask)} 种，累计补到 {len(found - have)} 种")

    # 2. iNaturalist 观察记录
    names = {k: photographed(k) for k in KINGDOM}
    ask = [t for t in todo if t[0] not in found and t[0] not in cache["obs"] and t[1].lower() in names[t[2]]]
    print(f"iNaturalist：GBIF 列出有开放许可照片的种名 {sum(map(len, names.values()))} 个，待查 {len(ask)} 种")
    for n, t in enumerate(ask, 1):
        try:
            cache["obs"][t[0]] = obs_photo(t[1], t[2])
        except RuntimeError:
            pass  # 接口一直不通：不记缓存，下次再查
        if n % 200 == 0 or n == len(ask):
            save()
            print(f"  {n}/{len(ask)}，其中有图 {sum(1 for x in ask[:n] if cache['obs'].get(x[0]))}", flush=True)
    save()

    # 补进快照
    new = rows(have)
    if not new:
        print("没有新的图")
        return
    p = RAW / "more_images.ndjson"
    with open(p, "w", encoding="utf-8") as f:
        for r in new:
            f.write(json.dumps({k: r.get(k) for k in COLUMNS}, ensure_ascii=False) + "\n")
    cols = ", ".join(f"'{k}': 'VARCHAR'" for k in COLUMNS)
    out = SNAP / "images.parquet"
    con.execute(f"create table images as select * from '{out}' union all by name select * from read_json('{p}', format='newline_delimited', columns={{{cols}}})")
    con.execute(f"copy (select {', '.join(COLUMNS)} from images order by taxon_id, {', '.join(COLUMNS)}) to '{out}' (format parquet, compression snappy)")
    p.unlink()
    by = {}
    for r in new:
        by[r["source"]] = by.get(r["source"], 0) + 1
    print(f"补进快照 {len(new)} 张（{'，'.join(f'{k} {v}' for k, v in by.items())}），现在 {len(have) + len(new)} 种有图")


if __name__ == "__main__":
    sys.exit(main())
