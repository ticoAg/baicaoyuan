// 专题列表。数据和网站的专题页同一份（/data/topics.json），下载一次后存在本机。
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { H1, Note } from '@/components/ui';
import { loadTopics, type Topic } from '@/lib/api';
import { useColors, type Palette } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

export const topicTone = (c: Palette, kind: Topic['kind']) => (kind === 'danger' ? c.toxic : kind === 'warn' ? c.warn : kind === 'ok' ? c.ok : c.rule);

export default function Topics() {
  const c = useColors();
  const { data: topics, error, retry } = useLoad(loadTopics);

  return (
    <Screen>
      <H1>专题</H1>
      {!topics ? (
        error ? (
          <Pressable onPress={retry} style={{ marginTop: 16 }}>
            <Note>专题没下载下来，连上网后点这里重试。</Note>
          </Pressable>
        ) : (
          <Note style={{ marginTop: 16 }}>正在读取…</Note>
        )
      ) : (
        <View style={{ gap: 12, marginTop: 16 }}>
          {topics.map((t) => (
            <Pressable
              key={t.slug}
              onPress={() => router.push({ pathname: '/topic/[slug]', params: { slug: t.slug } })}
              style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.accentWash : c.surface, borderColor: c.rule, borderTopColor: topicTone(c, t.kind) }]}
            >
              <View style={styles.cardHead}>
                <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700' }}>{t.title}</Text>
                <Text style={{ color: c.ink3, fontSize: 13 }}>{t.items.length.toLocaleString('zh-CN')} 种</Text>
              </View>
              <Text style={{ color: c.ink2, fontSize: 14, lineHeight: 21, marginTop: 4 }}>{t.lead}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 8, borderWidth: 1, borderTopWidth: 3 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
});
