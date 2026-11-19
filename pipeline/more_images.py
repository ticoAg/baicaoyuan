"""给还没有图的物种补图。

    uv run python more_images.py

按顺序试两个来源，每个物种取到一张就停：

1. Wikidata 的配图（P18）。build.py 靠 Commons 的结构化数据查作者，很多老图没有这项，整张被丢掉
   （番茄就是这样）。这里改用 Commons 接口的 extmetadata 取作者与许可。
2. iNaturalist 观察记录里的照片，经 GBIF 检索。inat.py 只取物种页上的几张代表照片，
   它们常是 NC 许可；观察记录里另有大量 CC0、CC BY、CC BY-SA 的照片。

查询结果缓存在 data/raw/more_images.json（查过没有的也记下，下次不再问），
然后直接补进 data/snapshot/images.parquet，不必重跑整条管线。build.py 也读这份缓存，重新构建时不会丢。
只收 CC0、公有领域、CC BY、CC BY-SA，且查得到作者的（公有领域的可以没有作者）。全量约一小时。
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
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
INAT_PHOTO = re.compile(r"^https://inaturalist-open-data\.s3\.amazonaws\.com/photos/(\d+)/original\.(\w+)$")
COLUMNS = ["taxon_id", "url", "thumb", "page", "file", "author", "license", "license_url", "source"]


def call(method: str, url: str, **kw) -> requests.Response:
    """限流（429）或服务端出错时等一等再试。"""
    headers = {**UA, **kw.pop("headers", {})}
    for attempt in range(8):
        try:
            r = requests.request(method, url, headers=headers, timeout=180, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                wait = r.headers.get("Retry-After", "")
                time.sleep(min(int(wait) if wait.isdigit() else 15 * (attempt + 1), 180))
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
    author = re.sub(r"^User:", "", v("Artist"))
    if author.lower() in ("", "unknown", "unknown author", "anonymous"):
        if name != "公有领域" and not name.startswith("CC0"):
            return None
        author = "佚名"
    return {"author": author[:80], "license": name, "license_url": url or None}


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


# ── 2. iNaturalist 观察记录（经 GBIF）────────────────────────────────
INAT_CODE = [("publicdomain/zero", "cc0"), ("licenses/by-sa/", "cc-by-sa"), ("licenses/by/", "cc-by")]


def gbif_photo(sci: str, kingdom: str) -> dict | None:
    r = call("GET", GBIF, params={
        "scientificName": sci, "kingdomKey": KINGDOM[kingdom], "datasetKey": INAT_DATASET,
        "mediaType": "StillImage", "license": ["CC0_1_0", "CC_BY_4_0"], "limit": 20,
    })
    for rec in r.json().get("results", []):
        # GBIF 按骨干分类匹配学名，异名可能带出别的物种：只收鉴定到这个种（或其种下）的记录
        if rec.get("species") != sci and not (rec.get("verbatimScientificName") or "").startswith(sci):
            continue
        for m in rec.get("media", []):
            hit = INAT_PHOTO.match(m.get("identifier") or "")
            code = next((c for k, c in INAT_CODE if k in (m.get("license") or "")), None)
            author = (m.get("creator") or m.get("rightsHolder") or "").strip()
            if hit and code and (author or code == "cc0"):
                return {"id": int(hit.group(1)), "ext": hit.group(2), "license": code, "author": author or "佚名"}
    return None


# ── 缓存 → 图片行 ────────────────────────────────────────────────────
def load() -> dict:
    return json.loads(CACHE.read_text()) if CACHE.exists() else {"commons": {}, "gbif": {}}


def rows(have: set[str]) -> list[dict]:
    """缓存里查到的图，给 have 以外的物种，一种一张。build.py 也调用这里。"""
    cache, out = load(), []
    for tid in sorted(set(cache["commons"]) | set(cache["gbif"])):
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
        elif g := cache["gbif"].get(tid):
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
    ask = [t for t in todo if t[0] not in found and t[0] not in cache["gbif"]]
    print(f"GBIF：待查 {len(ask)} 种")
    with ThreadPoolExecutor(8) as pool:
        for n, (t, photo) in enumerate(zip(ask, pool.map(lambda t: gbif_photo(t[1], t[2]), ask)), 1):
            cache["gbif"][t[0]] = photo
            if n % 500 == 0 or n == len(ask):
                save()
                print(f"  {n}/{len(ask)}，其中有图 {sum(1 for x in ask[:n] if cache['gbif'].get(x[0]))}", flush=True)
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
