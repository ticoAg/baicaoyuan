"""受控词表：把来源里的英文 / 繁体取值转成本项目的中文用词。"""

from __future__ import annotations

import re

# ── 分布：TDWG 三级区（中国分 10 个区）──────────────────────────────
REGIONS = {
    "CHM": ("东北", ["黑龙江", "吉林", "辽宁"]),
    "CHI": ("内蒙古—宁夏", ["内蒙古", "宁夏"]),
    "CHN": ("华北—西北东部", ["北京", "天津", "河北", "山西", "山东", "陕西", "甘肃"]),
    "CHX": ("新疆", ["新疆"]),
    "CHQ": ("青海", ["青海"]),
    "CHT": ("西藏", ["西藏"]),
    "CHC": ("西南—华中", ["四川", "重庆", "贵州", "云南", "湖北"]),
    "CHS": (
        "华东—华南",
        ["河南", "安徽", "江苏", "上海", "浙江", "江西", "湖南", "福建", "广东", "广西", "香港", "澳门"],
    ),
    "CHH": ("海南", ["海南"]),
    "TAI": ("台湾", ["台湾"]),
}

# ── 安全等级：数值越大越严 ───────────────────────────────────────────
# edible / processed / limited 只能由人工审核过的词条给出，管线不会自动产生。
LEVELS = {
    "unknown": 0,       # 没有足够证据：不要吃
    "food_record": 1,   # 有食用记录，未经审核：不能据此食用
    "edible": 2,        # 可食
    "processed": 3,     # 处理后可食
    "limited": 4,       # 少量
    "restricted": 5,    # 监管机构未确认其食用安全性
    "suspect": 6,       # 可能有毒：名称提示有毒，没有毒性分级
    "toxic": 7,         # 有毒
    "deadly": 8,        # 致命
}

# ── WCVP 生活型 ──────────────────────────────────────────────────────
LIFEFORM_HEAD = {
    "perennial": "多年生草本",
    "annual": "一年生草本",
    "biennial": "二年生草本",
    "tree": "乔木",
    "shrub": "灌木",
    "subshrub": "亚灌木",
    "climber": "藤本",
    "liana": "木质藤本",
    "bamboo": "竹类",
    "epiphyte": "附生植物",
    "lithophyte": "石生植物",
    "geophyte": "地下芽植物",
    "helophyte": "沼生植物",
    "hydrophyte": "水生植物",
    "hydroannual": "一年生水生草本",
    "hydroperennial": "多年生水生草本",
    "hydrosubshrub": "水生亚灌木",
    "hydrogeophyte": "水生地下芽植物",
    "holoparasite": "全寄生植物",
    "holomycotroph": "菌类异养植物",
    "chamaephyte": "地上芽植物",
    "succulent": "肉质植物",
}
LIFEFORM_MOD = {
    "rhizomatous": "根茎类",
    "tuberous": "块茎类",
    "bulbous": "鳞茎类",
    "pseudobulbous": "具假鳞茎",
    "climbing": "攀援",
    "scrambling": "蔓生",
    "epiphytic": "附生",
    "lithophytic": "石生",
    "hemiepiphytic": "半附生",
    "succulent": "肉质",
    "semisucculent": "半肉质",
    "hemiparasitic": "半寄生",
    "holoparasitic": "全寄生",
    "holomycotrophic": "菌类异养",
    "monocarpic": "一次结实",
    "herbaceous": "草质",
    "semiaquatic": "半水生",
}


def lifeform_zh(s: str | None) -> str | None:
    """'climbing shrub or liana' → '攀援灌木或木质藤本'。有不认识的词就原样返回。"""
    if not s:
        return None
    alts = []
    for alt in re.split(r"\s*(?:,| or )\s*", s.strip().lower()):
        words = alt.split()
        if not words:
            continue
        head = LIFEFORM_HEAD.get(words[-1])
        mods = [LIFEFORM_MOD.get(w) for w in words[:-1]]
        if head is None or any(m is None for m in mods):
            return s
        alts.append("".join(mods) + head)
    return "或".join(dict.fromkeys(alts)) or None


CLIMATE = {
    "temperate": "温带",
    "subtropical": "亚热带",
    "wet tropical": "湿润热带",
    "seasonally dry tropical": "季节性干旱热带",
    "subalpine or subarctic": "亚高山或亚寒带",
    "desert or dry shrubland": "荒漠或干旱灌丛",
    "subtropical or tropical": "亚热带或热带",
    "montane tropical": "热带山地",
}

# ── 中国有用植物数据集的用途类别 ─────────────────────────────────────
USE_CATEGORY = {
    "药用": "药用",
    "食品（蔬菜/水果/粮食/调料）": "食用",
    "观赏/绿化": "观赏",
    "木材/建筑": "木材",
    "饲料": "饲料",
    "工业原料": "工业原料",
    "纤维": "纤维",
    "油料": "油料",
    "农药": "农药",
    "染料/色素": "染料",
    "祭祀/文化": "文化",
    "其他": "其他",
}
# 只是把类别重说一遍、没有信息量的用途文字
GENERIC_USE_TEXT = {
    "药用", "医药", "药用植物", "食用", "食品", "食用（ED）", "food", "观赏", "观赏植物",
    "木材类植物", "纤维", "纤维类植物", "油脂类", "油料", "饲料", "动物饲料植物", "其他",
}

# ── WCFP 的用途标记 ──────────────────────────────────────────────────
WCFP_FLAGS = {
    "human_food": "食用",
    "medicines": "药用",
    "poisons": "毒物",
    "animal_food": "饲料",
    "materials": "材料",
    "fuels": "燃料",
    "environmental_uses": "环境用途",
    "gene_sources": "基因资源",
    "social_uses": "社会用途",
    "invertebrate_food": "蜜源等无脊椎动物食物",
}

# ── TPPT ─────────────────────────────────────────────────────────────
# 对人毒性分级 → (本项目等级, 来源原分级的中文)。等级为 None 的只作提示，不改变安全等级。
TPPT_HUMAN = {
    "very strong toxic": ("deadly", "剧毒"),
    "strong toxic": ("toxic", "强毒"),
    "toxic": ("toxic", "有毒"),
    "weak toxic": ("toxic", "弱毒"),
    "toxic (unknown strength)": ("toxic", "有毒（强度不明）"),
    "liver toxic": ("toxic", "肝毒性"),
    "carcinogenic": ("toxic", "致癌"),
    "cytotoxic": ("toxic", "细胞毒性"),
    "allergenic": (None, "致敏"),
    "skin-irritating": (None, "刺激皮肤"),
    "phototoxic": (None, "光毒性"),
    "stimulating": (None, "兴奋作用"),
    "estrogenic": (None, "雌激素样作用"),
    "infested plants only": (None, "仅染病植株有毒"),
    "nontoxic": (None, "无毒"),
    "unknown": (None, None),
}
TPPT_PART = {
    "whole plant": "全株",
    "whole part": "全株",
    "aerial part": "地上部分",
    "fruit": "果实",
    "leaf": "叶",
    "seed": "种子",
    "latex": "乳汁",
    "root": "根",
    "bulb": "鳞茎",
    "bark": "树皮",
    "pollen": "花粉",
    "rhizome": "根茎",
    "tuber": "块茎",
    "herb": "全草",
    "young herb": "幼苗",
    "young plant": "幼株",
    "flower": "花",
    "flowering top": "花枝顶部",
    "flowering top of female plant": "雌株花枝顶部",
    "wood": "木材",
    "capsule": "蒴果",
    "leaf (blooming herb)": "叶（开花期）",
    "shoot": "嫩枝",
    "seed coat": "种皮",
    "root bark": "根皮",
    "root cortex": "根皮",
    "tree bark": "树皮",
    "fuit": "果实",
    "latex (without seed)": "乳汁（种子除外）",
    "whole plant without aril (red seed coat)": "全株（红色假种皮除外）",
    "whole plant without fruit": "全株（果实除外）",
}


def _tppt_list(s: str) -> str | None:
    out = []
    for tok in re.split(r"\s*,\s*", s.strip()):
        zh = TPPT_PART.get(tok.strip().lower())
        if zh is None:
            return None
        out.append(zh)
    return "、".join(out)


def tppt_part_zh(s: str | None) -> tuple[str | None, str | None]:
    """'Whole plant, highest concentrations in seed' → ('全株', '种子含量最高')。"""
    if not s:
        return None, None
    s = s.strip()
    m = re.match(r"^(.*?),\s*highest concentrationt?s? in (.*)$", s, re.I)
    if m:
        part, hi = _tppt_list(m.group(1)), _tppt_list(m.group(2))
        if part and hi:
            return part, f"{hi}含量最高"
        return s, None
    m = re.match(r"^(.*?)\s*\(or whole (?:plant|part|fruit)( without(?: fruit)?)?\)$", s, re.I)
    if m:
        part = _tppt_list(m.group(1))
        if part:
            return part, "或全株（果实除外）" if m.group(2) else "或全株"
        return s, None
    part = _tppt_list(s)
    return (part or s), None


# ── 真菌（Wikidata）──────────────────────────────────────────────────
# P789 可食性 → (本项目等级, 中文)。等级为 None 的不改变安全等级。
FUNGUS_EDIBILITY = {
    "Q19888591": ("deadly", "致命"),
    "Q359511": ("toxic", "有毒"),
    "Q1169875": ("toxic", "致幻"),
    "Q19888579": ("toxic", "致敏"),
    "Q19888537": ("food_record", "需处理后食用"),
    "Q62102033": ("food_record", "煮熟后可食"),
    "Q654236": ("food_record", "食用"),
    "Q19888517": ("food_record", "食用（上佳）"),
    "Q1686195": (None, "药用"),
    "Q4317894": (None, "不可食"),
}
FUNGUS_TRAIT = {
    "P783": "子实层类型",
    "P784": "菌盖形状",
    "P785": "菌褶着生",
    "P786": "菌柄",
    "P787": "孢子印颜色",
    "P788": "生态类型",
}
FUNGUS_VALUE = {
    # 子实层类型
    "Q269345": "菌褶", "Q19861549": "菌孔", "Q2034230": "产孢组织（腹菌）", "Q19861550": "平滑",
    "Q19861551": "脊状褶", "Q19861552": "菌齿",
    # 菌盖形状
    "Q14544535": "凸形", "Q19887957": "平展", "Q19887965": "无菌盖", "Q19887954": "圆锥形",
    "Q19887955": "中部下凹", "Q19887958": "漏斗形", "Q62023127": "半球形", "Q19887964": "具中央突起",
    "Q14544541": "偏生", "Q19887953": "钟形", "Q19887961": "卵形",
    # 菌褶着生
    "Q14544569": "直生", "Q14544563": "离生", "Q19887925": "延生", "Q19887923": "弯生（狭附生）",
    "Q19887932": "无", "Q19887926": "凹生", "Q19887930": "波状弯生", "Q19887931": "稍延生",
    "Q19887929": "后期离生",
    # 菌柄
    "Q14544581": "光裸", "Q14544582": "有菌环", "Q19887987": "有菌环和菌托", "Q19887985": "有菌托",
    "Q19887988": "有丝膜", "Q131915205": "有网纹",
    # 孢子印颜色
    "Q23444": "白色", "Q47071": "褐色", "Q19888352": "橄榄褐色", "Q2730433": "奶油色",
    "Q864152": "橄榄色", "Q23445": "黑色", "Q943": "黄色", "Q19888381": "紫褐色",
    "Q19888339": "黑褐色", "Q194191": "赭色", "Q429220": "粉红色", "Q10859033": "酒红色",
    "Q16645086": "橙黄色", "Q2085487": "浅黄褐色", "Q2015138": "鲑肉色", "Q1670336": "棕褐色",
    "Q19888373": "紫黑色", "Q19888366": "粉褐色", "Q3257809": "紫色", "Q62058583": "橙红色",
    "Q3133": "绿色",
    # 生态类型
    "Q99974": "菌根菌", "Q114750": "腐生菌", "Q186517": "寄生菌", "Q357006": "捕食线虫真菌",
}

# ── 台湾食药署食品原料平台 ───────────────────────────────────────────
TW_FDA_SUBCAT = {
    "草、木本植物類(1)供茶包、膳食調理包或萃取後作為原料": "供茶包、膳食调理包或萃取后作为原料",
    "草、木本植物類(2)可供直接食用": "可供直接食用",
    "草、木本植物類(3)供香辛調味使用": "供香辛调味使用",
    "草、木本植物類來源製取之原料": "由植物制取的原料",
    "菇蕈類及其來源製取之原料": "菇蕈类及其制取的原料",
    "藻類及其來源製取之原料": "藻类及其制取的原料",
}
