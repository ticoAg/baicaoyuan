// 后台改过的词条在搜索里的样子。搜索索引是构建时生成的静态文件，改动在下次部署前靠这份补丁生效。
// 一行：[id, 学名, 中文名, 别名（| 分隔）, 科, 等级, 界]
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { LEVEL_CODES } from '../../lib/shared.js';
import { unavailable } from '../../lib/species';

export const prerender = false;

interface Row { id: string; patch: string; sci: string | null; zh: string | null; alias: string | null; fam: string | null; famZh: string | null; safety: string | null; k: string | null }

export const GET: APIRoute = async () => {
  try {
    const { results } = await env.DB.prepare(
      `SELECT e.id, e.patch, json_extract(s.doc, '$.sci') AS sci, json_extract(s.doc, '$.zh') AS zh, json_extract(s.doc, '$.alias') AS alias,
              json_extract(s.doc, '$.fam') AS fam, json_extract(s.doc, '$.famZh') AS famZh, json_extract(s.doc, '$.safety') AS safety, json_extract(s.doc, '$.k') AS k
       FROM edits e LEFT JOIN species s ON s.id = e.id ORDER BY e.updated DESC LIMIT 2000`,
    ).all<Row>();
    const rows = results.map((r) => {
      const base = { sci: r.sci, zh: r.zh, alias: r.alias ? (JSON.parse(r.alias) as string[]) : [], fam: r.fam, famZh: r.famZh, safety: r.safety, k: r.k };
      const sp = { ...base, ...(JSON.parse(r.patch) as Partial<typeof base>) };
      return [r.id, sp.sci ?? r.id, sp.zh || 0, (sp.alias ?? []).join('|') || 0, sp.famZh ?? sp.fam ?? 0, Math.max(0, LEVEL_CODES.indexOf(sp.safety ?? 'unknown')), sp.k === 'fungus' ? 1 : 0];
    });
    return Response.json({ rows }, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (err) {
    return unavailable(err, true);
  }
};
