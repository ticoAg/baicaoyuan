// 蘑菇特征检索。筛选规则和网站同一份（web/src/lib/finder.ts）；数据下载一次后存在本机，没网也能筛。
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { filterFinder, type FinderItem, type Picked } from '@core/finder';
import { AidLink, Button, Chip, Fold, H1, Lead, levelOf, Note, SpeciesRow } from '@/components/ui';
import { loadFinder } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

const SWATCH: Record<string, string> = { 白: '#f6f3ea', 粉: '#e4aea6', 黄: '#e0bf5c', 褐: '#8a5a35', 橄榄: '#7b7b3d', 紫: '#6b4568', 黑: '#262421', 绿: '#7aa26d' };

type Row = { it: FinderItem; extra: string };

export default function Finder() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data, error, retry } = useLoad(loadFinder);
  const [picked, setPicked] = useState<Picked>({});

  const result = useMemo(() => (data ? filterFinder(data, picked) : null), [data, picked]);
  const toggle = (key: string, i: number) =>
    setPicked((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
    });

  const sections = result
    ? [
        { title: '符合', count: result.match.length, data: result.match.map((it): Row => ({ it, extra: it[4] })) },
        ...(result.maybe.length ? [{ title: '无法排除', count: result.maybe.length, data: result.maybe.map(([it, why]): Row => ({ it, extra: why })) }] : []),
      ]
    : [];

  const header = (
    <View style={{ paddingTop: insets.top + 16 }}>
      <H1>蘑菇特征检索</H1>
      <Lead>只选看得清的特征，拿不准的不要选。</Lead>
      {!data ? (
        error ? (
          <Pressable onPress={retry} style={{ marginTop: 16 }}>
            <Note>检索数据没下载下来，连上网后点这里重试。</Note>
          </Pressable>
        ) : (
          <Note style={{ marginTop: 16 }}>正在准备检索数据…</Note>
        )
      ) : (
        <View style={{ gap: 16, marginTop: 18 }}>
          {data.facets.map((f) => (
            <View key={f.key}>
              <Text style={[styles.legend, { color: c.ink2 }]}>{f.name}</Text>
              <View style={styles.chips}>
                {f.options.map((o, i) => (
                  <Chip key={o} label={o} on={picked[f.key]?.includes(i)} onPress={() => toggle(f.key, i)} swatch={f.key === 'sp' ? SWATCH[o] : undefined} />
                ))}
              </View>
            </View>
          ))}
          {result ? <Button label="清除" onPress={() => setPicked({})} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      )}
      {result?.deadly.length ? (
        <View style={[styles.alarm, { backgroundColor: c.deadlyBg }]} accessibilityRole="alert">
          <Text style={{ color: c.deadly, fontWeight: '700', lineHeight: 22 }}>
            候选里有 {result.deadly.length} 种致命的：{result.deadly.slice(0, 8).map((it) => it[1]).join('、')}
            {result.deadly.length > 8 ? ' 等' : ''}
          </Text>
        </View>
      ) : null}
      {result && !result.match.length ? <Note style={{ marginTop: 20 }}>没有符合的。</Note> : null}
    </View>
  );

  const footer = data ? (
    <View style={{ marginTop: 28, gap: 12 }}>
      <Fold label={`没有特征记录的有毒蘑菇 ${data.untracked.length} 种，检索不到`} gap={0}>
        {data.untracked.map(([id, zh, sci, level, fam]) => (
          <SpeciesRow key={id} id={id} zh={zh} sci={sci} level={levelOf(level)} extra={fam} />
        ))}
      </Fold>
      <Note>特征检索只用来缩小范围，不能用来确认一种蘑菇可以吃。特征来自 Wikidata，{data.items.length} 种蘑菇有记录。</Note>
      <AidLink />
    </View>
  ) : undefined;

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      sections={sections}
      keyExtractor={(r) => r.it[0]}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) =>
        section.count ? (
          <View style={[styles.sectionHead, { borderBottomColor: c.rule }]}>
            <Text style={{ color: c.ink, fontSize: 19, fontWeight: '700' }}>{section.title}</Text>
            <Text style={{ color: c.ink3, fontSize: 13 }}>{section.count} 种</Text>
          </View>
        ) : null
      }
      renderItem={({ item: { it, extra } }) => <SpeciesRow id={it[0]} zh={it[1]} sci={it[2]} level={levelOf(it[3])} extra={extra} />}
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
