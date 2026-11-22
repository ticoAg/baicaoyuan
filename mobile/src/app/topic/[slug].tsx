// 一个专题：按科分组，可以在本页筛选。危险类专题给急救入口。
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { AidLink, H1, Lead, levelOf, Note, SpeciesRow } from '@/components/ui';
import { loadTopics, type Topic } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

export default function TopicPage() {
  const c = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: topics, error, retry } = useLoad(loadTopics);
  const topic = topics?.find((t) => t.slug === slug);
  const [q, setQ] = useState('');
  const [titled, setTitled] = useState(false);

  const sections = useMemo(() => {
    if (!topic) return [];
    const needle = q.trim().toLowerCase();
    const groups = new Map<string, Topic['items']>();
    for (const it of topic.items) {
      if (needle && !`${it[1] || ''} ${it[2]}`.toLowerCase().includes(needle)) continue;
      const fam = it[4];
      if (!groups.has(fam)) groups.set(fam, []);
      groups.get(fam)!.push(it);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [topic, q]);

  if (!topic)
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: c.paper }}>
        {topics ? (
          <Note>没有这个专题。</Note>
        ) : error ? (
          <Pressable onPress={retry}>
            <Note>专题没下载下来，连上网后点这里重试。</Note>
          </Pressable>
        ) : (
          <Note>正在读取…</Note>
        )}
      </View>
    );

  return (
    <>
      <Stack.Screen options={{ title: titled ? topic.title : '' }} />
      <SectionList
        style={{ flex: 1, backgroundColor: c.paper }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        sections={sections}
        keyExtractor={(it) => it[0]}
        keyboardShouldPersistTaps="handled"
        // 标题滚出屏幕后放到顶栏
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > 56;
          if (past !== titled) setTitled(past);
        }}
        scrollEventThrottle={64}
        stickySectionHeadersEnabled={false}
        initialNumToRender={24}
        ListHeaderComponent={
          <View style={{ paddingTop: 8 }}>
            <H1>{topic.title}</H1>
            <Lead>{topic.lead}</Lead>
            <Note style={{ marginTop: 8 }}>{topic.source}</Note>
            {topic.kind === 'danger' ? <AidLink /> : null}
            {topic.slug === 'poisonous-mushrooms' ? (
              <Pressable onPress={() => router.navigate('/finder')} style={{ marginTop: 10 }}>
                <Text style={{ color: c.accentInk, textDecorationLine: 'underline', fontSize: 15 }}>按特征检索蘑菇</Text>
              </Pressable>
            ) : null}
            <View style={styles.filterRow}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="在本页筛选"
                placeholderTextColor={c.ink3}
                style={[styles.filter, { color: c.ink, backgroundColor: c.surface, borderColor: c.rule }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={{ color: c.ink3, fontSize: 13 }}>{topic.items.length.toLocaleString('zh-CN')} 种</Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.group, { color: c.ink2 }]}>
            {section.title}
            <Text style={{ color: c.ink3, fontWeight: '400' }}>{`  ${section.data.length}`}</Text>
          </Text>
        )}
        renderItem={({ item: [id, zh, sci, level, , extra] }) => <SpeciesRow id={id} zh={zh} sci={sci} level={levelOf(level)} extra={extra} />}
        ListEmptyComponent={<Note style={{ marginTop: 16 }}>没有符合的。</Note>}
      />
    </>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  filter: { flex: 1, height: 42, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, fontSize: 15 },
  group: { fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 4 },
});
