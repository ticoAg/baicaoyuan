"""给物种取 iNaturalist 上开放许可的物种照片，结果缓存到 data/raw/inat_photos.json。

    uv run python inat.py

只记照片的编号、作者、许可；图片留在 iNaturalist，网站直接引用。
不收 NC、ND 和保留所有权利的照片。接口建议每分钟不超过 60 次请求，全量约半小时。
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

import requests

import vocab

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
CANDIDATES = RAW / "inat_candidates.json"
OUT = RAW / "inat_photos.json"
API = "https://api.inaturalist.org/v1/taxa/{}?per_page=30"
UA = {"User-Agent": "baicaoyuan-pipeline/0.1 (https://github.com/ticoAg/baicaoyuan)"}
BATCH = 30  # 接口一次最多 30 个物种
KEEP = 3  # 每个物种最多留几张


def fetch(ids: list[str]) -> list[dict]:
    for attempt in range(6):
        try:
            r = requests.get(API.format(",".join(ids)), headers=UA, timeout=60)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(min(int(r.headers.get("Retry-After", 0)) or 15 * (attempt + 1), 120))
                continue
            r.raise_for_status()
            return r.json()["results"]
        except requests.RequestException as e:
            print(f"  请求失败，重试：{e}")
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("iNaturalist 接口连续失败")


def open_photos(taxon: dict) -> list[dict]:
    out = []
    for tp in taxon.get("taxon_photos") or []:
        p = tp.get("photo") or {}
        url = p.get("medium_url") or ""
        m = re.search(r"inaturalist-open-data\.s3\.amazonaws\.com/photos/(\d+)/medium\.(\w+)$", url)
        author = (p.get("attribution_name") or "").strip()
        if not m or p.get("license_code") not in vocab.INAT_LICENSE or p.get("flags"):
            continue
        if not author and p["license_code"] not in ("cc0", "pd"):
            continue
        out.append({"id": int(m.group(1)), "ext": m.group(2), "license": p["license_code"], "author": author or "佚名"})
        if len(out) == KEEP:
            break
    return out


def main() -> None:
    if not CANDIDATES.exists():
        raise SystemExit("没有 inat_candidates.json，先运行 build.py")
    wanted = sorted(set(json.loads(CANDIDATES.read_text()).values()), key=int)
    done: dict[str, list] = json.loads(OUT.read_text()) if OUT.exists() else {}
    todo = [i for i in wanted if i not in done]
    print(f"候选 {len(wanted)} 种，已有 {len(wanted) - len(todo)}，待取 {len(todo)}")
    for n in range(0, len(todo), BATCH):
        ids = todo[n : n + BATCH]
        got = {str(t["id"]): open_photos(t) for t in fetch(ids)}
        for i in ids:
            done[i] = got.get(i, [])  # 没有开放许可照片的也记下来，下次不再问
        if (n // BATCH) % 20 == 19 or n + BATCH >= len(todo):
            OUT.write_text(json.dumps(done, ensure_ascii=False))
            print(f"  {min(n + BATCH, len(todo))}/{len(todo)}，其中有图 {sum(1 for i in todo[: n + BATCH] if done[i])}")
        time.sleep(1.1)
    OUT.write_text(json.dumps(done, ensure_ascii=False))
    print(f"完成：{sum(1 for i in wanted if done.get(i))} / {len(wanted)} 种有开放许可的照片")


if __name__ == "__main__":
    main()
