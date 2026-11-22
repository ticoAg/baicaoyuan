// 各页面共用的小部件。样式照网站：纸色底、墨色字、一个绿色；安全等级用形状加文字，不只靠颜色。
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { glyphSvg, LEVEL_CODES, LEVELS } from '@core/shared.js';
import { font, toneColors, useColors } from '@/lib/theme';

type LevelKey = keyof typeof LEVELS;
/** 等级代码（数字）或等级名 → 等级名；不认识的算"未知"。 */
export const levelOf = (code: number | string | undefined): LevelKey => {
  const k = typeof code === 'number' ? LEVEL_CODES[code] : code;
  return k && k in LEVELS ? (k as LevelKey) : 'unknown';
};

/** 等级图形。 */
export function Glyph({ level, size = 16, color }: { level: LevelKey; size?: number; color?: string }) {
  const c = useColors();
  return <SvgXml xml={glyphSvg(level)} width={size} height={size} color={color ?? toneColors(c, LEVELS[level].tone).fg} />;
}

/** 图形 + 等级名。 */
export function LevelTag({ level, label, size = 14 }: { level: LevelKey; label?: string; size?: number }) {
  const c = useColors();
  const fg = toneColors(c, LEVELS[level].tone).fg;
  return (
    <View style={styles.tag} accessibilityLabel={`${LEVELS[level].label}：${LEVELS[level].hint}`}>
      <Glyph level={level} size={size} />
      <Text style={{ color: fg, fontWeight: '600', fontSize: size }}>{label ?? LEVELS[level].label}</Text>
    </View>
  );
}

/** 物种列表的一行：图形、中文名、学名、附注。 */
export function SpeciesRow({ id, zh, sci, level, extra }: { id: string; zh?: string | 0; sci: string; level: LevelKey; extra?: string | 0 }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/s/[id]', params: { id } })}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.rule2, backgroundColor: pressed ? c.accentWash : 'transparent' }]}
      accessibilityRole="link"
      accessibilityLabel={`${zh || sci}，${LEVELS[level].label}`}
    >
      <View style={styles.rowGlyph}>
        <Glyph level={level} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        {zh ? <Text style={[styles.rowName, { color: c.ink }]}>{zh}</Text> : <Text style={[styles.rowName, font.sci, { color: c.ink }]}>{sci}</Text>}
        {zh ? <Text style={[styles.rowSci, font.sci, { color: c.ink3 }]}>{sci}</Text> : null}
        {extra ? <Text style={[styles.rowExtra, { color: c.ink2 }]}>{extra}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Section({ title, count, children, style }: { title: string; count?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.section, style]}>
      <View style={[styles.sectionHead, { borderBottomColor: c.rule }]}>
        <Text style={[styles.h2, { color: c.ink }]}>{title}</Text>
        {count != null ? <Text style={{ color: c.ink3, fontSize: 13 }}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Note({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[{ color: c.ink3, fontSize: 13, lineHeight: 20 }, style]}>{children}</Text>;
}

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.h1, { color: c.ink }]}>{children}</Text>;
}

export function Lead({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.ink2, fontSize: 16, lineHeight: 25, marginTop: 4 }}>{children}</Text>;
}

/** 点了跳到急救页。 */
export function AidLink({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable onPress={() => router.navigate('/aid')} style={[styles.aidLink, style]} accessibilityRole="link" hitSlop={8}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z" fill={c.toxic} />
      </Svg>
      <Text style={{ color: c.toxic, fontWeight: '700', fontSize: 16 }}>已经吃了？看急救</Text>
    </Pressable>
  );
}

/** 折叠的一段：点标题展开。 */
export function Fold({ label, children, style, gap = 8 }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6}>
        <Text style={{ color: c.ink3, fontSize: 14 }}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open ? <View style={{ gap, marginTop: 8 }}>{children}</View> : null}
    </View>
  );
}

/** 外部链接：用系统浏览器打开。 */
export function ExtLink({ href, children, style }: { href: string; children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text style={[{ color: c.accentInk, textDecorationLine: 'underline' }, style]} onPress={() => Linking.openURL(href)} accessibilityRole="link">
      {children}
    </Text>
  );
}

/** 圆角小按钮：多选，或 role="radio" 时单选。 */
export function Chip({ label, on, onPress, swatch, role = 'checkbox' }: { label: string; on?: boolean; onPress: () => void; swatch?: string; role?: 'checkbox' | 'radio' }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: !!on }}
      style={[styles.chip, { borderColor: on ? c.accent : c.rule, backgroundColor: on ? c.accent : c.surface }]}
    >
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch, borderColor: c.ink3 }]} /> : null}
      <Text style={{ color: on ? c.onAccent : c.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, primary, disabled, style }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { borderColor: primary ? c.accent : c.rule, backgroundColor: primary ? c.accent : pressed ? c.accentWash : c.surface, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Text style={{ color: primary ? c.onAccent : c.accentInk, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  rowGlyph: { width: 26, paddingTop: 4 },
  rowName: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  rowSci: { fontSize: 13, lineHeight: 18 },
  rowExtra: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  section: { marginTop: 28 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingBottom: 6, borderBottomWidth: 1, marginBottom: 6 },
  h1: { fontSize: 30, fontWeight: '700', lineHeight: 38 },
  h2: { fontSize: 19, fontWeight: '700' },
  aidLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  button: { height: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
