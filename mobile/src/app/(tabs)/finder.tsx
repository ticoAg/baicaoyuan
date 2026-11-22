// 特征检索：先选植物还是蘑菇，再选看得到的特征。筛选规则和网站同一份（web/src/lib/finder.ts），
// 数据是搜索索引，和首页搜索共用，下载一次后存在本机，没网也能筛。
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { filterFinder, GROUPS, isGroup, recordedCount, type Group, type Picked } from '@core/finder';
import { entryId, type Entry } from '@core/match';
import { AidLink, Button, Chip, H1, Lead, levelOf, Note, SpeciesRow } from '@/components/ui';
import { loadSearchIndex } from '@/lib/api';
import { readPref, writePref } from '@/lib/store';
import { useColors } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

const PAGE = 100;
const SWATCH: Record<string, string> = { 白: '#f6f3ea', 粉: '#e4aea6', 黄: '#e0bf5c', 褐: '#8a5a35', 橄榄: '#7b7b3d', 紫: '#6b4568', 黑: '#262421', 绿: '#7aa26d' };
const SOURCE: Record<Group, string> = { plant: '植物的生活型、气候、分布来自 WCVP', fungus: '蘑菇的特征来自 Wikidata' };

type Part = 'match' | 'maybe';
type Row = { e: Entry; extra: string };
const n = (x: number) => x.toLocaleString('zh-CN');

export default function Finder() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data: index, error, retry } = useLoad(loadSearchIndex);

  // 先选哪一类：链接里的 k 优先（专题页点过来的），其次是上次选的
  const { k } = useLocalSearchParams<{ k?: string }>();
  const [saved, setSaved] = useState<Group | null>(null);
  useEffect(() => {
    readPref('finder-group').then((v) => {
      if (isGroup(v)) setSaved((cur) => cur ?? v);
    });
  }, []);
  const group = isGroup(k) ? k : saved;
  const choose = (g: Group) => {
    setSaved(g);
    router.setParams({ k: g });
    writePref('finder-group', g);
  };

  // 两类的特征名不重复，选过的放在一起；换一类再换回来，原来选的还在
  const [picked, setPicked] = useState<Picked>({});
  const facets = index && group ? index.facets[group] : [];
  const toggle = (key: string, i: number) =>
    setPicked((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
    });
  const clear = () =>
    setPicked((p) => {
      const next = { ...p };
      for (const f of facets) delete next[f.key];
      return next;
    });

  const result = useMemo(() => (index && group ? filterFinder(index, group, picked) : null), [index, group, picked]);
  const recorded = useMemo(() => (index && group ? recordedCount(index, group) : 0), [index, group]);

  // 每段先显示 100 种；条件变了从头来
  const query = `${group}:${JSON.stringify(picked)}`;
  const [paged, setPaged] = useState({ query, match: PAGE, maybe: PAGE });
  const shown = paged.query === query ? paged : { query, match: PAGE, maybe: PAGE };
  const more = (part: Part) => setPaged({ ...shown, [part]: shown[part] + PAGE });

  const sections = result
    ? [
        { part: 'match' as Part, title: '符合', total: result.match.length, data: result.match.slice(0, shown.match).map((e): Row => ({ e, extra: e.fam })) },
        ...(result.maybe.length
          ? [{ part: 'maybe' as Part, title: '无法排除', total: result.maybe.length, data: result.maybe.slice(0, shown.maybe).map(([e, why]): Row => ({ e, extra: why })) }]
          : []),
      ]
    : [];

  const open = (e: Entry) => router.push({ pathname: '/s/[id]', params: { id: entryId(e) } });

  const header = (
    <View style={{ paddingTop: insets.top + 16 }}>
      <H1>特征检索</H1>
      <Lead>先选植物还是蘑菇，再选看得清的特征；拿不准的不要选。</Lead>
      <View style={{ gap: 16, marginTop: 18 }}>
        <View>
          <Text style={[styles.legend, { color: c.ink2 }]}>是什么</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {GROUPS.map(([g, label]) => (
              <Chip key={g} label={label} on={group === g} onPress={() => choose(g)} role="radio" />
            ))}
          </View>
        </View>
        {!group ? null : !index ? (
          error ? (
            <Pressable onPress={retry}>
              <Note>检索数据没下载下来，连上网后点这里重试。</Note>
            </Pressable>
          ) : (
            <Note>正在准备检索数据…</Note>
          )
        ) : !facets.length ? (
          // 本机存的是旧版索引，还没有特征
          <Note>检索数据要更新，连上网后重新打开 App。</Note>
        ) : (
          <>
            {facets.map((f) => (
              <View key={f.key}>
                <Text style={[styles.legend, { color: c.ink2 }]}>{f.name}</Text>
                <View style={styles.chips}>
                  {f.options.map((o, i) => (
                    <Chip key={o} label={o} on={picked[f.key]?.includes(i)} onPress={() => toggle(f.key, i)} swatch={f.key === 'sp' ? SWATCH[o] : undefined} />
                  ))}
                </View>
              </View>
            ))}
            {result ? <Button label="清除" onPress={clear} style={{ alignSelf: 'flex-start' }} /> : null}
          </>
        )}
      </View>
      {result?.deadly.length ? (
        <View style={[styles.alarm, { backgroundColor: c.deadlyBg }]} accessibilityRole="alert">
          <Text style={{ color: c.deadly, fontWeight: '700', lineHeight: 22 }}>
            候选里有 {result.deadly.length} 种致命的：
            {result.deadly.slice(0, 8).map((e, i) => (
              <Text key={entryId(e)}>
                {i ? '、' : ''}
                <Text onPress={() => open(e)} style={{ textDecorationLine: 'underline' }} accessibilityRole="link">
                  {e.zh || e.sci}
                </Text>
              </Text>
            ))}
            {result.deadly.length > 8 ? ' 等' : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ marginTop: 28, gap: 12 }}>
      <Note>
        特征检索只用来缩小范围，不能用来确认能不能吃。
        {index && group && facets.length ? `${SOURCE[group]}，${n(recorded)} 种有记录。` : ''}
      </Note>
      <AidLink />
    </View>
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      sections={sections}
      keyExtractor={(r) => entryId(r.e)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHead, { borderBottomColor: c.rule }]}>
          <Text style={{ color: c.ink, fontSize: 19, fontWeight: '700' }}>{section.title}</Text>
          <Text style={{ color: c.ink3, fontSize: 13 }}>{n(section.total)} 种</Text>
        </View>
      )}
      renderSectionFooter={({ section }) =>
        !section.total ? (
          <Note style={{ marginTop: 8 }}>没有符合的。</Note>
        ) : section.total > section.data.length ? (
          <Button label={`再显示 ${n(Math.min(PAGE, section.total - section.data.length))} 种`} onPress={() => more(section.part)} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
        ) : null
      }
      renderItem={({ item: { e, extra } }) => <SpeciesRow id={entryId(e)} zh={e.zh} sci={e.sci} level={levelOf(e.level)} extra={extra} />}
      initialNumToRender={20}
    />
  );
}

const styles = StyleSheet.create({
  legend: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alarm: { marginTop: 20, padding: 14, borderRadius: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 6, borderBottomWidth: 1, marginTop: 24, marginBottom: 4 },
});
