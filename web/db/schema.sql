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
-- by 是最后改它的人。
CREATE TABLE IF NOT EXISTS edits (
  id      TEXT PRIMARY KEY,
  patch   TEXT NOT NULL,
  created INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL,
  by      TEXT NOT NULL
) WITHOUT ROWID;

-- 每次保存留一条记录：谁、什么时候、改成了什么。patch 为空表示放弃改动或删除词条。
CREATE TABLE IF NOT EXISTS edit_log (
  n     INTEGER PRIMARY KEY AUTOINCREMENT,
  id    TEXT NOT NULL,
  who   TEXT NOT NULL,
  at    TEXT NOT NULL,
  patch TEXT
);

-- 维护者。申请时 status 是 pending，管理员通过后是 active；拒绝或移除就删掉这一行。
-- 密码只存加盐的哈希。
CREATE TABLE IF NOT EXISTS users (
  name    TEXT PRIMARY KEY,
  salt    TEXT NOT NULL,
  hash    TEXT NOT NULL,
  status  TEXT NOT NULL,
  created TEXT NOT NULL
) WITHOUT ROWID;
