// 物种页：结论在最上面，证据在最下面，顺序和网站的物种页一样。数据看过一次就存在本机。
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { PROVINCE_TILES, REGIONS } from '@core/shared.js';
import { imagesOf, isDanger, issueUrl, partRows, REDLIST, src, verdict, type Img, type Species } from '@core/verdict';
import { AidLink, ExtLink, Fold, Glyph, LevelTag, levelOf, Note, Section } from '@/components/ui';
import { HttpError, imageSource, loadSources, loadSpecies, REPO, SITE } from '@/lib/api';
import { font, toneColors, useColors } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

export default function SpeciesPage() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: sp, error, retry } = useLoad(useCallback(() => loadSpecies(id), [id]));
  const [titled, setTitled] = useState(false);

  // 名字滚出屏幕后放到顶栏
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > 64;
    if (past !== titled) setTitled(past);
  };

  if (!sp)
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: c.paper }}>
        {error instanceof HttpError && error.status === 404 ? (
          <Note>没有这个物种。</Note>
        ) : error ? (
          <Pressable onPress={retry}>
            <Note>没有网络，这一页之前也没打开过。连上网后点这里重试。</Note>
          </Pressable>
        ) : (
          <Note>正在读取…</Note>
        )}
      </View>
    );

  const name = sp.zh ?? sp.sci;
  const fungus = sp.k === 'fungus';
  const reviewed = !!sp.eat?.length;
  const rows = partRows(sp);
  const flags = sp.flags ?? [];
  const uses = sp.uses ?? [];
  const showUses = !reviewed && (flags.length > 0 || uses.length > 0);
  const images = imagesOf(sp);
  const used = new Set<string>([
    ...(sp.dist?.length || (sp.k === 'plant' && !sp.manual) ? ['wcvp'] : []),
    ...rows.map((r) => r.src),
    ...(showUses ? flags.flatMap((f) => f.src) : []),
    ...(showUses && uses.length ? ['cn_useful'] : []),
    ...(sp.traits?.length || sp.wd ? ['wikidata'] : []),
    ...images.map((im) => im.src),
  ]);

  return (
    <>
      <Stack.Screen options={{ title: titled ? name : '' }} />
      <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 48 }} onScroll={onScroll} scrollEventThrottle={64}>
        <Head sp={sp} />
        <Verdict sp={sp} />
        {isDanger(sp.safety) ? <AidLink /> : null}
        {fungus ? (
          <Text style={[styles.fixed, { color: c.toxic, borderColor: c.toxic }]}>
            颜色、银针、虫咬都不能用来判断蘑菇有没有毒。{reviewed ? '这里说的是市场上卖的栽培品，野外采到长得像的不要吃。' : ''}
          </Text>
        ) : null}
        {images.length ? <Gallery images={images} name={name} /> : null}

        {rows.length ? (
          <Section title="各部位">
            {rows.map((r, i) => (
              <View key={i} style={[styles.part, { borderBottomColor: c.rule2 }]}>
                <View style={styles.partTop}>
                  <Text style={{ color: r.part ? c.ink : c.ink3, fontSize: 16, fontWeight: '600', flexShrink: 1 }}>{r.part ?? '未注明'}</Text>
                  {r.level ? <LevelTag level={levelOf(r.level)} label={r.label} /> : <Text style={{ color: c.ink3 }}>{r.label ?? '—'}</Text>}
                </View>
                {r.use ? <Text style={{ color: c.ink2, fontSize: 15, lineHeight: 22 }}>{r.use}</Text> : null}
                {r.note ? <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 21 }}>{r.note}</Text> : null}
                <Text style={{ color: c.ink3, fontSize: 12, lineHeight: 18 }}>
                  {src(r.src)}
                  {r.ref ? ` · ${r.ref}` : ''}
                </Text>
              </View>
            ))}
            <Note style={{ marginTop: 8 }}>没有列出的部位，按“不要吃”对待。</Note>
          </Section>
        ) : null}

        {sp.traits?.length ? (
          <Section title="怎么认">
            {[...new Set(sp.traits.map((t) => t[0]))].map((k) => (
              <Fact key={k} k={k} v={[...new Set(sp.traits!.filter((t) => t[0] === k).map((t) => t[1]))].join('、')} />
            ))}
            <Note style={{ marginTop: 8 }}>只能用来缩小范围，不能据此确认物种。</Note>
          </Section>
        ) : null}

        {showUses ? <Uses sp={sp} /> : null}
        {sp.k === 'plant' && !sp.manual ? <Distribution sp={sp} /> : null}

        <Section title="分类">
          {sp.ord ? <Fact k="目" v={sp.ord} /> : null}
          <Fact k="科" v={sp.famZh ? `${sp.famZh}  ${sp.fam ?? ''}` : (sp.fam ?? '未定')} />
          <Fact k="属" v={sp.genZh ?? sp.gen} sci={sp.genZh ? sp.gen : undefined} />
          <Fact k="类群" v={fungus ? '真菌' : '维管植物'} />
        </Section>

        {sp.lf || sp.cl || (sp.k === 'plant' && !sp.manual) ? (
          <Section title="习性">
            {sp.lf ? <Fact k="生活型" v={sp.lf} /> : null}
            {sp.cl ? <Fact k="气候" v={sp.cl} /> : null}
            {sp.k === 'plant' && !sp.manual ? <Fact k="来历" v={`${sp.nat ? '中国原生' : sp.cn ? '引入后归化' : '中国无野生分布记录'}${sp.cult ? '，栽培作物' : ''}`} /> : null}
            {sp.rl && REDLIST[sp.rl] ? <Fact k="红色名录" v={`${REDLIST[sp.rl]}（${sp.rl}）`} /> : null}
          </Section>
        ) : null}

        <Section title="别处查看">
          <View style={{ gap: 10 }}>
            {[
              sp.powo && ['Plants of the World Online', `https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:${sp.powo}`],
              sp.k === 'plant' && ['植物智（中国植物志）', `https://www.iplant.cn/info/${encodeURIComponent(sp.sci)}`],
              sp.zhwiki && ['中文维基百科', `https://zh.wikipedia.org/wiki/${encodeURIComponent(sp.zhwiki)}`],
              sp.wd && ['Wikidata', `https://www.wikidata.org/wiki/${sp.wd}`],
              ['GBIF', `https://www.gbif.org/species/search?q=${encodeURIComponent(sp.sci)}`],
            ]
              .filter((l): l is [string, string] => !!l)
              .map(([label, href]) => (
                <ExtLink key={href} href={href} style={{ fontSize: 15 }}>
                  {label}
                </ExtLink>
              ))}
          </View>
        </Section>

        <Sources sp={sp} used={used} reviewed={reviewed} />
      </ScrollView>
    </>
  );
}

function Head({ sp }: { sp: Species }) {
  const c = useColors();
  const alias = sp.alias ?? [];
  return (
    <View>
      <Text style={[styles.h1, { color: c.ink }, !sp.zh && font.sci]}>{sp.zh ?? sp.sci}</Text>
      <Text style={{ color: c.ink2, fontSize: 16, marginTop: 2 }}>
        {sp.zh ? <Text style={font.sci}>{sp.sci}</Text> : null}
        {sp.au ? <Text style={{ color: c.ink3, fontSize: 14 }}>{`  ${sp.au}`}</Text> : null}
        {!sp.zh ? <Text style={{ color: c.ink3, fontSize: 14 }}>暂无中文名</Text> : null}
      </Text>
      <Text style={{ color: c.ink2, fontSize: 14, marginTop: 6 }}>
        {sp.famZh ?? sp.fam ?? '未定科'}
        {sp.famZh && sp.fam ? <Text style={{ color: c.ink3 }}>{`  ${sp.fam}`}</Text> : null}
      </Text>
      {alias.length ? (
        <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 22, marginTop: 8 }}>
          <Text style={{ color: c.ink3 }}>别名　</Text>
          {alias.slice(0, 24).join(' · ')}
          {alias.length > 24 ? <Text style={{ color: c.ink3 }}>{`  等 ${alias.length} 个`}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

function Verdict({ sp }: { sp: Species }) {
  const c = useColors();
  const v = verdict(sp);
  const deadly = v.lv.tone === 'deadly';
  const tone = toneColors(c, v.lv.tone);
  const fg = deadly ? c.deadly : tone.fg;
  const text = deadly ? c.deadly : c.ink;
  return (
    <View
      style={[styles.verdict, deadly ? { backgroundColor: c.deadlyBg, borderColor: c.deadlyBg } : { backgroundColor: tone.wash, borderColor: `${tone.fg}59`, borderLeftColor: tone.fg }]}
      accessibilityLabel="安全结论"
    >
      <View style={{ paddingTop: 4 }}>
        <Glyph level={levelOf(sp.safety)} size={28} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: fg, fontSize: 22, fontWeight: '700', lineHeight: 30 }}>
          {v.lv.label}
          {sp.safety === 'unknown' ? ' · 不要吃' : ''}
          {sp.safety === 'food_record' ? <Text style={{ fontSize: 14, fontWeight: '500' }}>{'  不能据此食用'}</Text> : null}
        </Text>
        {v.lines.map((l, i) => (
          <Text key={i} style={{ color: text, fontSize: 15, lineHeight: 23 }}>
            {l}
          </Text>
        ))}
        {v.tail ? <Text style={{ color: text, fontSize: 13, lineHeight: 20, opacity: 0.9 }}>{v.tail}</Text> : null}
      </View>
    </View>
  );
}

const imgSite = (im: Img) => (im.src === 'inat' ? 'iNaturalist' : im.src === 'upload' ? '来源' : 'Wikimedia Commons');

function Gallery({ images, name }: { images: Img[]; name: string }) {
  const c = useColors();
  const [at, setAt] = useState(0);
  const [ratio, setRatio] = useState(4 / 3);
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const im = images[at];
  return (
    <View style={{ marginTop: 18 }}>
      <Image
        source={imageSource(im.url)}
        placeholder={imageSource(im.thumb)}
        style={{ width: '100%', aspectRatio: Math.min(1.8, Math.max(0.8, ratio)), borderRadius: 8, backgroundColor: c.mutedWash }}
        contentFit="cover"
        transition={150}
        onLoad={(e) => e.source.width && setRatio(e.source.width / e.source.height)}
        onError={() => images.length === 1 && setBroken(true)}
        accessibilityLabel={`${name}的照片`}
      />
      <Text style={{ color: c.ink3, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
        图：{im.author} · {im.licenseUrl ? <ExtLink href={im.licenseUrl}>{im.license}</ExtLink> : im.license}
        {im.page ? (
          <>
            {' · '}
            <ExtLink href={im.page}>{imgSite(im)}</ExtLink>
          </>
        ) : null}
      </Text>
      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
          {images.map((t, i) => (
            <Pressable key={t.url} onPress={() => setAt(i)} accessibilityRole="button" accessibilityLabel={`第 ${i + 1} 张`} accessibilityState={{ selected: i === at }}>
              <Image source={imageSource(t.thumb)} style={[styles.thumb, { backgroundColor: c.mutedWash, borderColor: i === at ? c.accent : 'transparent', opacity: i === at ? 1 : 0.6 }]} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Fact({ k, v, sci }: { k: string; v: string; sci?: string }) {
  const c = useColors();
  return (
    <View style={[styles.fact, { borderBottomColor: c.rule2 }]}>
      <Text style={{ width: 92, color: c.ink3, fontSize: 14, lineHeight: 22 }}>{k}</Text>
      <Text style={{ flex: 1, color: c.ink, fontSize: 15, lineHeight: 22 }}>
        {v}
        {sci ? <Text style={[font.sci, { color: c.ink3, fontSize: 14 }]}>{`  ${sci}`}</Text> : null}
      </Text>
    </View>
  );
}

function Chips({ items }: { items: string[] }) {
  const c = useColors();
  return (
    <View style={styles.chips}>
      {items.map((t, i) => (
        <Text key={i} style={[styles.chip, { backgroundColor: c.mutedWash, color: c.ink }]}>
          {t}
        </Text>
      ))}
    </View>
  );
}

function Uses({ sp }: { sp: Species }) {
  const c = useColors();
  const flags = sp.flags ?? [];
  const refs = sp.refs ?? [];
  const wcfp = flags.find((f) => f.f === '食用' && f.ref);
  return (
    <Section title="用途记录">
      {flags.length ? (
        <View style={styles.chips}>
          {flags.map((f) => (
            <Text key={f.f} style={[styles.chip, { backgroundColor: c.mutedWash, color: c.ink }]}>
              {f.f}
              <Text style={{ color: c.ink3, fontSize: 12 }}>{`  ${f.src.map(src).join('、')}`}</Text>
            </Text>
          ))}
        </View>
      ) : null}
      {(sp.uses ?? []).map((u) => (
        <View key={u.c} style={[styles.use, { borderBottomColor: c.rule2 }]}>
          <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15 }}>{u.c}</Text>
          {u.texts?.length ? <Chips items={u.texts.slice(0, 30)} /> : null}
          {u.refs?.length ? (
            <Fold label={`文献 ${u.refs.length} 条 · 中国有用植物数据集`}>
              {u.refs.map((i) => (
                <Text key={i} style={{ color: c.ink2, fontSize: 13, lineHeight: 19 }}>
                  {refs[i]}
                </Text>
              ))}
            </Fold>
          ) : null}
        </View>
      ))}
      {wcfp ? (
        <Fold label="WCFP 的食用文献" style={{ marginTop: 10 }}>
          {wcfp.ref!.split(/;\s+/).map((r, i) => (
            <Text key={i} style={{ color: c.ink2, fontSize: 13, lineHeight: 19 }}>
              {r}
            </Text>
          ))}
        </Fold>
      ) : null}
      <Note style={{ marginTop: 10 }}>有记载不代表安全。</Note>
    </Section>
  );
}

function Distribution({ sp }: { sp: Species }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const dist = new Map(sp.dist ?? []);
  if (!dist.size)
    return (
      <Section title="哪里有">
        <Note>没有它在中国野生分布的记录，多为栽培或进口的植物。</Note>
      </Section>
    );
  const status = new Map<string, 'n' | 'i'>();
  for (const [code, r] of Object.entries(REGIONS)) {
    const st = dist.get(code);
    if (st) for (const p of r.provinces) status.set(p, st);
  }
  const names = (st: 'n' | 'i') => Object.entries(REGIONS).filter(([code]) => dist.get(code) === st).map(([, r]) => r.name);
  const gap = 3;
  const size = Math.min(40, Math.floor((width - 32 - 7 * gap) / 8));
  return (
    <Section title="哪里有">
      <View
        style={{ width: 8 * size + 7 * gap, height: 8 * size + 7 * gap, marginTop: 6 }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`分布：${[...names('n'), ...names('i')].join('、')}`}
      >
        {PROVINCE_TILES.map(([abbr, full, col, row]) => {
          const st = status.get(full as string);
          return (
            <View
              key={full}
              style={[
                styles.tile,
                { left: (col as number) * (size + gap), top: (row as number) * (size + gap), width: size, height: size },
                st === 'n' ? { backgroundColor: c.accent } : st === 'i' ? { backgroundColor: c.accentWash, borderWidth: 1.5, borderColor: c.accent } : { backgroundColor: c.mutedWash },
              ]}
            >
              <Text style={{ fontSize: 13, color: st === 'n' ? c.onAccent : st === 'i' ? c.accentInk : c.ink3, fontWeight: st ? '600' : '400' }}>{abbr}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.key}>
        {(
          [
            ['原生', { backgroundColor: c.accent }],
            ['引入', { backgroundColor: c.accentWash, borderWidth: 1.5, borderColor: c.accent }],
            ['无记录', { backgroundColor: c.mutedWash }],
          ] as const
        ).map(([label, look]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={[{ width: 14, height: 14, borderRadius: 3 }, look]} />
            <Text style={{ color: c.ink2, fontSize: 13 }}>{label}</Text>
          </View>
        ))}
      </View>
      {names('n').length ? <Fact k="原生" v={names('n').join('、')} /> : null}
      {names('i').length ? <Fact k="引入" v={names('i').join('、')} /> : null}
      <Note style={{ marginTop: 8 }}>分布按大区记录，同一大区的省份一起着色，不代表每个省都有。</Note>
    </Section>
  );
}

function Sources({ sp, used, reviewed }: { sp: Species; used: Set<string>; reviewed: boolean }) {
  const c = useColors();
  const { data: all } = useLoad(loadSources);
  const list = all?.filter((s) => used.has(s.id));
  return (
    <Section title="出处">
      <View style={{ gap: 8 }}>
        {list
          ? list.map((s) => (
              <Text key={s.id} style={{ color: c.ink2, fontSize: 14, lineHeight: 21 }}>
                <ExtLink href={s.url}>{s.title}</ExtLink>
                {s.version ? <Text style={{ color: c.ink3 }}>{`（${s.version}）`}</Text> : null}
                {` · ${s.license}`}
              </Text>
            ))
          : [...used].map((id) => (
              <Text key={id} style={{ color: c.ink2, fontSize: 14 }}>
                {src(id)}
              </Text>
            ))}
      </View>
      {sp.manual ? <Text style={{ color: c.ink2, marginTop: 8 }}>本站录入的词条。</Text> : null}
      <Note style={{ marginTop: 12 }}>
        {reviewed ? '食用部位的结论经本站审核，其余内容尚未经人工审核。' : '以上内容尚未经人工审核。'}发现错误，请
        <ExtLink href={issueUrl(REPO, SITE, sp)}>提交纠错</ExtLink>。
      </Note>
      <ExtLink href={`${SITE}/s/${sp.id}`} style={{ fontSize: 14, marginTop: 12 }}>
        在网页上打开
      </ExtLink>
    </Section>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '700', lineHeight: 38 },
  verdict: { flexDirection: 'row', gap: 14, marginTop: 18, padding: 16, borderRadius: 8, borderWidth: 1, borderLeftWidth: 6 },
  fixed: { marginTop: 12, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, fontWeight: '600', fontSize: 15, lineHeight: 22 },
  thumb: { width: 74, height: 56, borderRadius: 4, borderWidth: 2 },
  part: { gap: 3, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  partTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  fact: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { fontSize: 14, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, overflow: 'hidden' },
  use: { gap: 4, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tile: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  key: { flexDirection: 'row', gap: 16, marginTop: 10, marginBottom: 6 },
});
