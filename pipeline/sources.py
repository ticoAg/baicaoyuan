"""数据源清单。

管线、网站的"数据来源"页、每条事实旁的出处标签都读这一份。
许可与实测情况的完整说明见 docs/sources.md。
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Source:
    id: str
    title: str
    license: str
    url: str
    version: str = ""
    citation: str = ""
    # 下载：{本地文件名: 地址}
    files: dict[str, str] = field(default_factory=dict)
    unzip: bool = False


SCIDB = "https://download.scidb.cn/download?fileId={}&username=&traceId="

SOURCES: list[Source] = [
    Source(
        id="wcvp",
        title="World Checklist of Vascular Plants (WCVP)",
        license="CC BY 4.0",
        url="https://powo.science.kew.org/about-wcvp",
        version="2026-06",
        citation="Govaerts R. (ed.). The World Checklist of Vascular Plants. Royal Botanic Gardens, Kew.",
        files={"wcvp.zip": "https://sftp.kew.org/pub/data-repositories/WCVP/wcvp.zip"},
        unzip=True,
    ),
    Source(
        id="wikidata",
        title="Wikidata",
        license="CC0 1.0",
        url="https://www.wikidata.org/",
        version="",
        citation="Wikidata contributors.",
    ),
    Source(
        id="taicol",
        title="臺灣物種名錄 TaiCOL",
        license="CC BY 4.0",
        url="https://taicol.tw/",
        version="2026-10-30",
        citation="臺灣物種名錄 (TaiCOL). 中央研究院生物多樣性研究中心.",
        files={"taicol.zip": "https://admin.taicol.tw/upload/TaiCOL_taxon_20261030.zip"},
        unzip=True,
    ),
    Source(
        id="cn_useful",
        title="中国有用植物数据集",
        license="CC BY 4.0",
        url="https://doi.org/10.57760/sciencedb.j00001.00212",
        version="V202101",
        citation="庄会富, 王亚楠, 王雨华 等. 中国有用植物数据集. Science Data Bank, 2021.",
        files={"cn_useful_plants.xlsx": SCIDB.format("5ffc0f101ef6f357d1aba35f")},
    ),
    Source(
        id="wcfp",
        title="World Checklist of Food Plants (WCFP)",
        license="CC BY 4.0",
        url="https://doi.org/10.6084/m9.figshare.31441615.v3",
        version="2026 v3",
        citation="World Checklist of Food Plants 2026. figshare.",
        files={"wcfp.zip": "https://ndownloader.figshare.com/files/71003193"},
        unzip=True,
    ),
    Source(
        id="tw_fda",
        title="食品原料整合查詢平臺（台湾食药署）",
        license="政府資料開放授權條款－第 1 版",
        url="https://data.gov.tw/dataset/8452",
        citation="衛生福利部食品藥物管理署. 食品原料整合查詢平臺.",
        files={"tw_fda_food_ingredients.csv": "https://data.fda.gov.tw/data/opendata/export/4/csv"},
    ),
    Source(
        id="tppt",
        title="Toxic Plants–PhytoToxins database (TPPT)",
        license="CC BY 4.0",
        url="https://zenodo.org/records/15758276",
        version="2022-07-16",
        citation="Günthardt B.F. et al. Comprehensive Toxic Plants–Phytotoxins Database. J. Agric. Food Chem. 2018. Agroscope.",
        files={"tppt.xlsx": "https://zenodo.org/api/records/15758276/files/TPPT_database.xlsx/content"},
    ),
    Source(
        id="cn_toxic_1997",
        title="中国有毒植物参考种数据集（1997年）",
        license="CC BY 4.0",
        url="https://doi.org/10.57760/sciencedb.iga.00893",
        version="V1",
        citation="中国科学院东北地理与农业生态研究所. 中国有毒植物参考种数据集（1997年）. Science Data Bank.",
        files={"cn_toxic_plants_1997.xlsx": SCIDB.format("a62d9f943a1dc05d7eb1478abbfac13c")},
    ),
    Source(
        id="xsbn",
        title="西双版纳民间传统利用植物信息数据集",
        license="CC BY 4.0",
        url="https://doi.org/10.57760/sciencedb.7",
        version="V1",
        citation="西双版纳民间传统利用植物信息数据集. Science Data Bank.",
        files={"xsbn_plants.xlsx": SCIDB.format("5ed074b65e972d1f52dfcb4c")},
    ),
    Source(
        id="commons",
        title="Wikimedia Commons",
        license="逐个文件授权（CC0 / 公有领域 / CC BY / CC BY-SA）",
        url="https://commons.wikimedia.org/",
    ),
    Source(
        id="inat",
        title="iNaturalist",
        license="逐张照片授权（CC0 / 公有领域 / CC BY / CC BY-SA）",
        url="https://www.inaturalist.org/",
        # 物种照片走 iNaturalist 接口（inat.py）；观察记录照片经 GBIF 检索（more_images.py）
        files={"inat_taxa.csv.gz": "https://inaturalist-open-data.s3.amazonaws.com/taxa.csv.gz"},
    ),
]

BY_ID = {s.id: s for s in SOURCES}
