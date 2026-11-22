// 拍照识别：照片在手机上缩小、重新编码（顺带去掉拍摄位置等信息），经网站转给 Pl@ntNet。
// 只给候选和相似度，不给"能不能吃"的结论。只认植物，不认蘑菇。
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LEVELS } from '@core/shared.js';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Button, ExtLink, H1, Lead, LevelTag, levelOf, Note } from '@/components/ui';
import { identify, imageSource, type Candidate } from '@/lib/api';
import { font, useColors } from '@/lib/theme';

const MAX_PHOTOS = 4;
const MAX_SIDE = 1600;
const MESSAGES: Record<string, string> = {
  quota: '今天的识别次数用完了，明天再来。',
  bad_image: '这张照片读不了，换一张试试。',
  unavailable: '识别服务暂时用不了，稍后再试。',
  offline: '识别要联网。连上网后再试。',
};

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; results: Candidate[] }
  | { kind: 'error'; message: string }
  | { kind: 'no-camera' };

/** 长边缩到 1600，重新存成 JPEG。 */
async function shrink(a: ImagePicker.ImagePickerAsset): Promise<{ uri: string }> {
  const ctx = ImageManipulator.manipulate(a.uri);
  if (Math.max(a.width, a.height) > MAX_SIDE) ctx.resize(a.width >= a.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.88, format: SaveFormat.JPEG });
  return { uri: out.uri };
}

const messageOf = (err: unknown) =>
  err instanceof TypeError ? MESSAGES.offline : (MESSAGES[(err as Error)?.message] ?? MESSAGES.unavailable);

export default function Identify() {
  const c = useColors();
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const seq = useRef(0);

  const run = async (assets: ImagePicker.ImagePickerAsset[], keep: { uri: string }[]) => {
    const mine = ++seq.current;
    setState({ kind: 'busy' });
    let next: { uri: string }[];
    try {
      next = [...keep, ...(await Promise.all(assets.slice(0, MAX_PHOTOS - keep.length).map(shrink)))];
    } catch {
      if (mine === seq.current) setState({ kind: 'error', message: MESSAGES.bad_image });
      return;
    }
    if (mine !== seq.current) return;
    setPhotos(next);
    try {
      const results = await identify(next);
      if (mine === seq.current) setState({ kind: 'done', results });
    } catch (err) {
      if (mine === seq.current) setState({ kind: 'error', message: messageOf(err) });
    }
  };

  // 安卓在内存紧张时会在拍照期间把应用关掉，回来后取回刚拍的照片
  useEffect(() => {
    ImagePicker.getPendingResultAsync().then((r) => {
      if (r && 'assets' in r && !r.canceled && r.assets?.length) run(r.assets, []);
    });
  }, []);

  /** add：加进当前这组（同一株）；否则换一组。 */
  const shoot = async (add = false) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setState({ kind: 'no-camera' });
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled && r.assets.length) run(r.assets, add ? photos : []);
  };
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS, orderedSelection: true, quality: 1 });
    if (!r.canceled && r.assets.length) run(r.assets, []);
  };

  const busy = state.kind === 'busy';

  return (
    <Screen>
      <H1>拍照识别</H1>
      <Lead>拍一张叶、花或果，看看它可能是什么。只认植物，不认蘑菇。</Lead>

      {photos.length ? (
        <>
          <View style={styles.photos}>
            {photos.map((p) => (
              <Image key={p.uri} source={{ uri: p.uri }} style={[styles.photo, { backgroundColor: c.mutedWash }]} contentFit="cover" />
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                onPress={() => shoot(true)}
                disabled={busy}
                style={({ pressed }) => [styles.photo, styles.add, { borderColor: c.rule, backgroundColor: pressed ? c.accentWash : c.surface }]}
                accessibilityRole="button"
                accessibilityLabel="同一株再拍一张"
              >
                <Text style={{ color: c.accentInk, fontSize: 28, lineHeight: 32 }}>+</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.again}>
            <Button label="重拍" onPress={() => shoot()} />
            <Button label="从相册选" onPress={pick} />
          </View>
        </>
      ) : (
        <>
          <Pressable
            onPress={() => shoot()}
            disabled={busy}
            style={({ pressed }) => [styles.shoot, { borderColor: pressed ? c.accent : c.rule, backgroundColor: pressed ? c.accentWash : c.surface }]}
            accessibilityRole="button"
            accessibilityLabel="拍照"
          >
            <Icon name="camera" color={c.accentInk} size={38} />
            <Text style={{ color: c.accentInk, fontSize: 18, fontWeight: '700' }}>拍照</Text>
            <Text style={{ color: c.ink3, fontSize: 13 }}>同一株植物最多 {MAX_PHOTOS} 张</Text>
          </Pressable>
          <Button label="从相册选" onPress={pick} style={{ marginTop: 12 }} />
        </>
      )}

      <View style={{ marginTop: 20 }} accessibilityLiveRegion="polite">
        {state.kind === 'busy' ? (
          <View style={styles.busy}>
            <ActivityIndicator color={c.accent} />
            <Text style={{ color: c.ink2 }}>识别中…</Text>
          </View>
        ) : state.kind === 'error' ? (
          <Text style={{ color: c.ink2, fontSize: 15 }}>{state.message}</Text>
        ) : state.kind === 'no-camera' ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.ink2, fontSize: 15 }}>没有相机权限。可以去系统设置里打开，或者从相册选。</Text>
            <Button label="去设置" onPress={() => Linking.openSettings()} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : state.kind === 'done' ? (
          state.results.length ? (
            <>
              {state.results[0].score < 0.2 ? <Text style={{ color: c.ink2, fontSize: 15, marginBottom: 10 }}>把握不大。换个角度，或者拍花和果再试。</Text> : null}
              <View style={{ borderTopWidth: 1, borderTopColor: c.rule }}>
                {state.results.map((r) => (
                  <CandidateRow key={r.sci} cand={r} />
                ))}
              </View>
            </>
          ) : (
            <Text style={{ color: c.ink2, fontSize: 15 }}>没认出植物。对准叶、花或果，拍近一点再试。</Text>
          )
        ) : null}
      </View>

      <Note style={{ marginTop: 28 }}>
        结果只是候选，不能凭照片判断能不能吃。照片会发给 <ExtLink href="https://plantnet.org/">Pl@ntNet</ExtLink> 做识别，本站不保存。
      </Note>
    </Screen>
  );
}

function CandidateRow({ cand }: { cand: Candidate }) {
  const c = useColors();
  const pct = Math.round(cand.score * 100);
  const level = cand.safety ? levelOf(cand.safety) : null;
  const rest = [...(cand.id ? [] : (cand.names ?? [])), cand.fam ?? ''].filter(Boolean).join(' · ');
  const body = (
    <>
      <View style={[styles.candImg, { backgroundColor: c.mutedWash }]}>
        {cand.thumb ? <Image source={imageSource(cand.thumb)} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.candTop}>
          <Text style={[{ fontSize: 18, fontWeight: '700', color: cand.id ? c.ink : c.ink2, flexShrink: 1 }, !cand.zh && font.sci]} numberOfLines={1}>
            {cand.zh ?? cand.sci}
          </Text>
          {level ? <LevelTag level={level} size={13} /> : <Text style={{ color: c.ink3, fontSize: 13 }}>未收录</Text>}
        </View>
        <Text style={{ color: c.ink3, fontSize: 13 }} numberOfLines={1}>
          {cand.zh ? <Text style={font.sci}>{cand.sci}</Text> : null}
          {rest ? `${cand.zh ? ' · ' : ''}${rest}` : ''}
        </Text>
        <View style={styles.meter}>
          <View style={[styles.bar, { backgroundColor: c.rule2 }]}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent }} />
          </View>
          <Text style={{ color: c.ink2, fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' }}>{pct}%</Text>
        </View>
        {cand.thumb && cand.credit ? (
          <Text style={{ color: c.ink3, fontSize: 11 }} numberOfLines={1}>
            图：{cand.credit}
          </Text>
        ) : null}
      </View>
    </>
  );
  const label = `${cand.zh ?? cand.sci}，${level ? LEVELS[level].label : '未收录'}，相似度 ${pct}%`;
  return cand.id ? (
    <Pressable
      onPress={() => router.push({ pathname: '/s/[id]', params: { id: cand.id! } })}
      style={({ pressed }) => [styles.cand, { borderBottomColor: c.rule2, backgroundColor: pressed ? c.accentWash : 'transparent' }]}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      {body}
    </Pressable>
  ) : (
    <View style={[styles.cand, { borderBottomColor: c.rule2 }]} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  shoot: { alignItems: 'center', gap: 6, paddingVertical: 44, marginTop: 20, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  photo: { width: 76, height: 76, borderRadius: 8 },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  again: { flexDirection: 'row', gap: 10, marginTop: 12 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cand: { flexDirection: 'row', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1 },
  candImg: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden' },
  candTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
});
