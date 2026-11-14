"""下载原始数据到 data/raw/。已存在的文件不重复下载。

    uv run python fetch.py            # 全部
    uv run python fetch.py wikidata   # 只抓某一个来源
"""

from __future__ import annotations

import sys
import time
import zipfile
from pathlib import Path

import requests

from sources import SOURCES

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
UA = "baicaoyuan-pipeline/0.1 (https://github.com/ticoAg/baicaoyuan)"
BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) baicaoyuan-pipeline/0.1"

SPARQL_ENDPOINTS = ["https://qlever.dev/api/wikidata", "https://query.wikidata.org/sparql"]

PREFIXES = """
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
"""

ZH = '("zh" "zh-cn" "zh-hans" "zh-hant" "zh-tw" "zh-hk" "zh-sg" "zh-my" "zh-mo")'

# 植物以 POWO ID（P5037）为锚，真菌以可食性声明（P789）为锚。
QUERIES: dict[str, str] = {
    "wd_plant_label": f"""
        SELECT ?item ?powo ?lang ?label WHERE {{
          ?item wdt:P5037 ?powo ; rdfs:label ?label .
          BIND(LANG(?label) AS ?lang) VALUES ?lang {{ {ZH[1:-1]} }}
        }}""",
    "wd_plant_common": f"""
        SELECT ?item ?powo ?lang ?name WHERE {{
          ?item wdt:P5037 ?powo ; wdt:P1843 ?name .
          BIND(LANG(?name) AS ?lang) VALUES ?lang {{ {ZH[1:-1]} }}
        }}""",
    "wd_plant_zhwiki": """
        SELECT ?item ?powo ?title WHERE {
          ?item wdt:P5037 ?powo .
          ?art schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> ; schema:name ?title .
        }""",
    "wd_plant_image": """
        SELECT ?item ?powo ?image WHERE { ?item wdt:P5037 ?powo ; wdt:P18 ?image . }""",
    "wd_fungus": """
        SELECT ?item ?name ?rankLabel ?edibility ?familyName ?genusName ?orderName ?if WHERE {
          ?item wdt:P789 ?edibility ; wdt:P225 ?name .
          OPTIONAL { ?item wdt:P105 ?rank . ?rank rdfs:label ?rankLabel FILTER(LANG(?rankLabel) = "en") }
          OPTIONAL { ?item wdt:P1391 ?if }
          OPTIONAL { ?item wdt:P171+ ?fam . ?fam wdt:P105 wd:Q35409 ; wdt:P225 ?familyName }
          OPTIONAL { ?item wdt:P171+ ?gen . ?gen wdt:P105 wd:Q34740 ; wdt:P225 ?genusName }
          OPTIONAL { ?item wdt:P171+ ?ord . ?ord wdt:P105 wd:Q36602 ; wdt:P225 ?orderName }
        }""",
    "wd_fungus_label": f"""
        SELECT ?item ?lang ?label WHERE {{
          ?item wdt:P789 ?e ; rdfs:label ?label .
          BIND(LANG(?label) AS ?lang) VALUES ?lang {{ {ZH[1:-1]} }}
        }}""",
    "wd_fungus_common": f"""
        SELECT ?item ?lang ?name WHERE {{
          ?item wdt:P789 ?e ; wdt:P1843 ?name .
          BIND(LANG(?name) AS ?lang) VALUES ?lang {{ {ZH[1:-1]} }}
        }}""",
    "wd_fungus_zhwiki": """
        SELECT ?item ?title WHERE {
          ?item wdt:P789 ?e .
          ?art schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> ; schema:name ?title .
        }""",
    "wd_fungus_image": """
        SELECT ?item ?image WHERE { ?item wdt:P789 ?e ; wdt:P18 ?image . }""",
    # 取值（可食性、形态）的中英文标签
    "wd_fungus_value_label": """
        SELECT DISTINCT ?value ?lang ?label WHERE {
          ?item wdt:P789 ?e .
          VALUES ?prop { wdt:P789 wdt:P783 wdt:P784 wdt:P785 wdt:P786 wdt:P787 wdt:P788 }
          ?item ?prop ?value . ?value rdfs:label ?label .
          BIND(LANG(?label) AS ?lang) VALUES ?lang { "zh" "zh-cn" "zh-hans" "zh-hant" "zh-tw" "en" }
        }""",
    # 科、属的中文名
    "wd_rank_label": """
        SELECT ?name ?rank ?lang ?label WHERE {
          VALUES ?rank { wd:Q35409 wd:Q34740 }
          ?item wdt:P105 ?rank ; wdt:P225 ?name ; rdfs:label ?label .
          BIND(LANG(?label) AS ?lang) VALUES ?lang { "zh" "zh-cn" "zh-hans" "zh-hant" "zh-tw" }
        }""",
    # 蘑菇形态：子实层类型、菌盖形状、菌褶着生、菌柄特征、孢子印颜色、生态类型
    "wd_fungus_morph": """
        SELECT ?item ?prop ?value WHERE {
          ?item wdt:P789 ?e .
          VALUES ?prop { wdt:P783 wdt:P784 wdt:P785 wdt:P786 wdt:P787 wdt:P788 }
          ?item ?prop ?value .
        }""",
}


def download(name: str, url: str, unzip: bool) -> None:
    dest = RAW / name
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  已有 {name}")
    else:
        print(f"  下载 {name} ← {url}")
        ua = BROWSER_UA if "scidb.cn" in url else UA
        with requests.get(url, headers={"User-Agent": ua}, stream=True, timeout=120) as r:
            r.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
            tmp.rename(dest)
    if unzip:
        out = RAW / dest.stem
        if not out.exists():
            with zipfile.ZipFile(dest) as z:
                z.extractall(out)


def sparql(name: str, query: str) -> None:
    dest = RAW / f"{name}.tsv"
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  已有 {dest.name}")
        return
    last: Exception | None = None
    for attempt in range(4):
        endpoint = SPARQL_ENDPOINTS[attempt % len(SPARQL_ENDPOINTS)]
        try:
            r = requests.post(
                endpoint,
                data={"query": PREFIXES + query},
                headers={"User-Agent": UA, "Accept": "text/tab-separated-values"},
                timeout=300,
            )
            r.raise_for_status()
            dest.write_bytes(r.content)
            print(f"  {dest.name}: {r.content.count(b'\n') - 1} 行 ← {endpoint}")
            return
        except Exception as e:  # noqa: BLE001 网络错误换端点重试
            last = e
            print(f"  {name} 失败（{endpoint}）：{e}")
            time.sleep(2**attempt)
    raise RuntimeError(f"{name} 抓取失败") from last


def main(only: set[str]) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for s in SOURCES:
        if only and s.id not in only:
            continue
        if s.files:
            print(s.id)
            for name, url in s.files.items():
                download(name, url, s.unzip)
    if not only or "wikidata" in only:
        print("wikidata")
        for name, q in QUERIES.items():
            sparql(name, q)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
