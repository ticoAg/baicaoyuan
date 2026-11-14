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
