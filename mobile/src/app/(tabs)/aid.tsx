// 急救：一屏看完，点了直接拨号。号码、做法、依据和网站的急救页是同一份（web/src/lib/aid.ts），全在本机，不用联网。
import { getCalendars } from 'expo-localization';
import { useEffect, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AID_REGIONS, AID_SOURCES, AID_STEPS, guessRegion, regionOf, tel } from '@core/aid';
import { Screen } from '@/components/Screen';
import { ExtLink, Fold, H1, Note } from '@/components/ui';
import { readPref, writePref } from '@/lib/store';
import { useColors } from '@/lib/theme';

const timeZone = () => {
  try {
    return getCalendars()[0]?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

export default function Aid() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState(() => guessRegion(timeZone()));
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    readPref('region').then((saved) => {
      if (saved && AID_REGIONS.some((r) => r[0] === saved)) setCode(saved);
    });
  }, []);

  const choose = (next: string) => {
    setCode(next);
    setPicking(false);
    writePref('region', next);
  };

  const [, name, call, second] = regionOf(code);

  return (
    <Screen>
      <H1>疑似中毒</H1>

      <View style={{ gap: 10, marginTop: 14 }}>
        {call ? (
          <Pressable
            onPress={() => Linking.openURL(tel(call))}
            style={({ pressed }) => [styles.call, { backgroundColor: c.deadlyBg, opacity: pressed ? 0.85 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`拨打 ${call}`}
          >
            <Svg width={26} height={26} viewBox="0 0 24 24">
              <Path d="M6.6 3.5h2.6l1.4 4.3-2 1.6a12 12 0 005.9 5.9l1.6-2 4.3 1.4v2.6a2 2 0 01-2.2 2A16.5 16.5 0 014.6 5.7a2 2 0 012-2.2z" fill="#fff" />
            </Svg>
            <Text style={styles.callText}>
              拨打 <Text style={styles.callNum}>{call}</Text>
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.call, { backgroundColor: c.deadlyBg }]}>
            <Text style={[styles.callText, { fontSize: 21 }]}>拨打当地的急救电话</Text>
          </View>
        )}
        {second ? (
          <Pressable
            onPress={() => Linking.openURL(tel(second[1]))}
            style={({ pressed }) => [styles.second, { borderColor: c.toxic, backgroundColor: pressed ? c.toxicWash : 'transparent' }]}
            accessibilityRole="button"
          >
            <Text style={{ color: c.toxic, fontSize: 16 }}>{second[0]}</Text>
            <Text style={{ color: c.toxic, fontSize: 19, fontWeight: '700' }}>{second[1]}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setPicking(true)} style={styles.regionRow} accessibilityRole="button" accessibilityLabel={`地区：${name}，点了更换`}>
          <Text style={{ color: c.ink2 }}>地区</Text>
          <View style={[styles.regionBox, { borderColor: c.rule, backgroundColor: c.surface }]}>
            <Text style={{ color: c.ink, fontSize: 16 }}>{name}</Text>
            <Text style={{ color: c.ink3 }}>▾</Text>
          </View>
        </Pressable>
      </View>

      <View style={{ gap: 14, marginTop: 24 }}>
        {AID_STEPS.map(([lead, rest], i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: c.toxicWash }]}>
              <Text style={{ color: c.toxic, fontWeight: '700' }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, color: c.ink, fontSize: 16, lineHeight: 25 }}>
              <Text style={{ fontWeight: '700' }}>{lead}</Text>
              {rest}
            </Text>
          </View>
        ))}
      </View>

      <Fold label="依据" style={{ marginTop: 24 }}>
        {AID_SOURCES.map(([title, by, url]) => (
          <Text key={url} style={{ color: c.ink2, fontSize: 14, lineHeight: 21 }}>
            <ExtLink href={url}>{title}</ExtLink>
            {` · ${by}`}
          </Text>
        ))}
      </Fold>
      <Note style={{ marginTop: 16 }}>这一页存在手机里，没有网络也能打开。</Note>

      <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]}>
          <FlatList
            data={AID_REGIONS}
            keyExtractor={(r) => r[0]}
            renderItem={({ item: [rc, rn, rcall] }) => (
              <Pressable onPress={() => choose(rc)} style={({ pressed }) => [styles.option, { borderBottomColor: c.rule2, backgroundColor: pressed ? c.accentWash : 'transparent' }]}>
                <Text style={{ color: c.ink, fontSize: 17, fontWeight: rc === code ? '700' : '400' }}>{rn}</Text>
                <Text style={{ color: c.ink3, fontSize: 15 }}>{rcall ?? ''}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  call: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 72, borderRadius: 14, paddingHorizontal: 16 },
  callText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  callNum: { fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  second: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: 14, borderWidth: 1.5 },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  regionBox: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 42, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8 },
  option: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
});
