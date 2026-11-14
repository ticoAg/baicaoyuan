"""给 Wikidata 上的配图（P18）补作者与许可，结果缓存到 data/raw/commons_meta.json。

    uv run python images.py

数据来自 Wikimedia Commons 的结构化数据（QLever 镜像），不走 Commons 的 API——后者限流很紧。
没有结构化作者信息的图片拿不到作者，build.py 不会把它们放进发布数据。
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.parse import quote, unquote

import duckdb
import requests

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
SNAPSHOT = RAW.parent / "snapshot"
OUT = RAW / "commons_meta.json"
UA = {"User-Agent": "baicaoyuan-pipeline/0.1 (https://github.com/ticoAg/baicaoyuan)", "Accept": "application/sparql-results+json"}
COMMONS = "https://qlever.dev/api/wikimedia-commons"
WIKIDATA = "https://qlever.dev/api/wikidata"

PREFIXES = """
PREFIX schema: <http://schema.org/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
"""
# 分成两个小查询、每批 25 个文件：合在一起或批量太大时，端点会超时或报错。
Q_LICENSE = PREFIXES + """
SELECT ?u ?license ?status WHERE {
  VALUES ?u { %s } ?file schema:url ?u .
  OPTIONAL { ?file wdt:P275 ?license } OPTIONAL { ?file wdt:P6216 ?status }
}"""
Q_AUTHOR = PREFIXES + """
SELECT ?u ?authorName ?username ?creator WHERE {
  VALUES ?u { %s } ?file schema:url ?u . ?file p:P170 ?st .
  OPTIONAL { ?st pq:P2093 ?authorName } OPTIONAL { ?st pq:P4174 ?username }
  OPTIONAL { ?st ps:P170 ?creator FILTER(isIRI(?creator)) }
}"""
BATCH = 25


def name_of(url: str) -> str:
    return unquote(url.strip("<>").rsplit("/", 1)[-1])


class QueryError(RuntimeError):
    pass


def sparql(endpoint: str, query: str) -> list[dict]:
    """限流（429）时等一等再试；查询本身出错（5xx）时抛出，由调用方拆小。"""
    waited = 0
    while True:
        r = requests.post(endpoint, data={"query": query}, headers=UA, timeout=180)
        if r.status_code == 429 and waited < 900:
            pause = min(int(r.headers.get("Retry-After", 30)), 120)
            waited += pause
            time.sleep(pause)
            continue
        if r.status_code >= 400:
            raise QueryError(f"{r.status_code} {r.text[:120]}")
        return [{k: v["value"] for k, v in b.items()} for b in r.json()["results"]["bindings"]]


def main() -> None:
    # 只查发布数据里用到的图片
    con = duckdb.connect()
    files = [r[0] for r in con.sql(f"select distinct file from '{SNAPSHOT}/images.parquet'").fetchall()]
    urls = sorted("<http://commons.wikimedia.org/wiki/Special:FilePath/" + quote(f, safe="") + ">" for f in files)
    meta: dict[str, dict] = json.loads(OUT.read_text()) if OUT.exists() else {}
    todo = [u for u in urls if name_of(u) not in meta]
    print(f"图片 {len(urls)}，待查 {len(todo)}")
    def fetch(batch: list[str]) -> None:
        rows = sparql(COMMONS, Q_LICENSE % " ".join(batch)) + sparql(COMMONS, Q_AUTHOR % " ".join(batch))
        for u in batch:
            meta[name_of(u)] = {}
        for b in rows:
            m = meta[name_of(b["u"])]
            for k in ("license", "status", "creator"):
                if k in b:
                    m.setdefault(k, b[k].rsplit("/", 1)[-1])
            author = b.get("authorName") or b.get("username")
            if author:
                m.setdefault("author", author)

    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        try:
            fetch(batch)
        except QueryError as e:
            if e.args[0].startswith("429"):
                raise  # 一直被限流：停下，下次接着跑
            for u in batch:  # 整批查询出错时逐个试，跳过查不动的
                try:
                    fetch([u])
                except QueryError:
                    meta[name_of(u)] = {}
        if i % 500 == 0:
            print(f"  {i}/{len(todo)}", flush=True)
            OUT.write_text(json.dumps(meta, ensure_ascii=False))
        time.sleep(1)
    OUT.write_text(json.dumps(meta, ensure_ascii=False))

    # 许可、作者条目的名称
    ids = sorted({m[k] for m in meta.values() for k in ("license", "creator") if m.get(k, "").startswith("Q")})
    labels: dict[str, dict] = {}
    for i in range(0, len(ids), 300):
        values = " ".join(f"wd:{q}" for q in ids[i : i + 300])
        for b in sparql(WIKIDATA, f"""
            PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?q ?label ?url ?spdx WHERE {{
              VALUES ?q {{ {values} }}
              ?q rdfs:label ?label FILTER(LANG(?label) = "en")
              OPTIONAL {{ ?q wdt:P856 ?url }} OPTIONAL {{ ?q wdt:P2479 ?spdx }}
            }}"""):
            d = labels.setdefault(b["q"].rsplit("/", 1)[-1], {})
            d["label"] = b["label"]
            for k in ("url", "spdx"):
                if k in b:
                    d.setdefault(k, b[k])
    (RAW / "commons_labels.json").write_text(json.dumps(labels, ensure_ascii=False, indent=1))
    have = sum(1 for m in meta.values() if m.get("license") or m.get("status"))
    print(f"有许可信息 {have}，有作者 {sum(1 for m in meta.values() if m.get('author') or m.get('creator'))}，许可种类 {len({m.get('license') for m in meta.values()})}")


if __name__ == "__main__":
    main()
