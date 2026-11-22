// 首页：搜索在最上面。名称索引第一次要下载（约 3 MB），之后存在本机，没网也能搜。
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { entryId, searchIndex, type Hit } from '@core/match';
import { LEVELS } from '@core/shared.js';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Glyph, levelOf, Note } from '@/components/ui';
import { loadSearchIndex } from '@/lib/api';
import { font, toneColors, useColors } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';

const TRIES = ['马齿苋', '钩吻', '番茄', '致命鹅膏', '香椿'];

const ENTRIES: [label: string, icon: IconName, go: () => void][] = [
  ['拍照识别', 'camera', () => router.navigate('/identify')],
  ['特征检索', 'finder', () => router.navigate('/finder')],
  ['毒蘑菇', 'topics', () => router.push({ pathname: '/topic/[slug]', params: { slug: 'poisonous-mushrooms' } })],
  ['误食急救', 'aid', () => router.navigate('/aid')],
];

export default function Home() {
  const c = useColors();
  const [q, setQ] = useState('');
  const { data: index, error, retry } = useLoad(loadSearchIndex);

  const hits = useMemo(() => (index && q.trim() ? searchIndex(index, q, 30) : []), [index, q]);

  return (
    <Screen>
      <Text style={[styles.brand, { color: c.ink }]}>
        百草<Text style={{ color: c.accent }}>园</Text>
      </Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="植物或蘑菇的名称、别名、拼音、学名"
        placeholderTextColor={c.ink3}
        style={[styles.input, { color: c.ink, backgroundColor: c.surface, borderColor: q ? c.accent : c.rule }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="搜索"
      />
      {!index && (error ? (
        <Pressable onPress={retry}>
          <Note style={{ marginTop: 8 }}>名称索引没下载下来，连上网后点这里重试。</Note>
        </Pressable>
      ) : (
        <Note style={{ marginTop: 8 }}>正在准备名称索引…</Note>
      ))}

      {q.trim() ? (
        <View style={{ marginTop: 8 }}>
          {index && !hits.length ? <Note style={{ marginTop: 8 }}>没有找到「{q.trim()}」。试试别名、拼音或学名。</Note> : null}
          {hits.map((h) => (
            <HitRow key={entryId(h.e)} hit={h} />
          ))}
        </View>
      ) : (
        <>
          <View style={styles.tries}>
            <Text style={{ color: c.ink3 }}>试试</Text>
            {TRIES.map((t) => (
              <Pressable key={t} onPress={() => setQ(t)} hitSlop={6}>
                <Text style={{ color: c.accentInk, textDecorationLine: 'underline' }}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.grid}>
            {ENTRIES.map(([label, icon, go]) => {
              const aid = icon === 'aid';
              return (
                <Pressable
                  key={label}
                  onPress={go}
                  style={({ pressed }) => [styles.entry, { backgroundColor: pressed ? c.accentWash : c.surface, borderColor: aid ? c.toxic : c.rule }]}
                >
                  <Icon name={icon} color={aid ? c.toxic : c.accentInk} size={28} />
                  <Text style={{ color: aid ? c.toxic : c.ink, fontSize: 16, fontWeight: '600' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

function HitRow({ hit }: { hit: Hit }) {
  const c = useColors();
  const { e, via } = hit;
  const level = levelOf(e.level);
  const fg = toneColors(c, LEVELS[level].tone).fg;
  const rest = [e.fam, e.fungus ? '真菌' : ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/s/[id]', params: { id: entryId(e) } })}
      style={({ pressed }) => [styles.hit, { borderBottomColor: c.rule2, backgroundColor: pressed ? c.accentWash : 'transparent' }]}
    >
      <View style={{ width: 26, paddingTop: 4 }}>
        <Glyph level={level} size={17} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.hitTop}>
          <Text style={[{ fontSize: 17, fontWeight: '600', color: c.ink, flexShrink: 1 }, !e.zh && font.sci]}>
            {e.zh || e.sci}
            {via ? <Text style={{ fontSize: 13, fontWeight: '400', color: c.ink3 }}>{`  别名：${via}`}</Text> : null}
          </Text>
          <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }}>{LEVELS[level].label}</Text>
        </View>
        <Text style={{ color: c.ink3, fontSize: 13 }} numberOfLines={1}>
          {e.zh ? <Text style={font.sci}>{e.sci}</Text> : null}
          {rest ? `${e.zh ? ' · ' : ''}${rest}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 28, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  input: { height: 52, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 20, fontSize: 16 },
  tries: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  entry: { width: '47%', flexGrow: 1, gap: 10, padding: 16, borderRadius: 12, borderWidth: 1 },
  hit: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  hitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
});
