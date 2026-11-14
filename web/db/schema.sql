-- 物种详情：一个物种一行，doc 是整份 JSON。
-- 免费额度每天只能写 10 万行，所以不拆表；hash 用来做增量同步，只写有变化的行。
CREATE TABLE IF NOT EXISTS species (
  id   TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  doc  TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

-- 拍照识别的每日用量。who 是访客标识的哈希，'*' 是全站合计；只留当天的行。
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,
  who TEXT NOT NULL,
  n   INTEGER NOT NULL,
  PRIMARY KEY (day, who)
) WITHOUT ROWID;

-- 后台维护的改动，一个物种一行，不随数据同步覆盖。
-- patch 是覆盖在物种详情上的字段（值为 null 表示去掉该字段）；created = 1 的是后台新建的词条，patch 就是整份详情。
CREATE TABLE IF NOT EXISTS edits (
  id      TEXT PRIMARY KEY,
  patch   TEXT NOT NULL,
  created INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL
) WITHOUT ROWID;
