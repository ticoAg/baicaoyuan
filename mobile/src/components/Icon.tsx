// 底栏和入口用的图标：24×24 描边，和网站的手机底栏一样。
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'home' | 'camera' | 'finder' | 'topics' | 'aid';

export function Icon({ name, color, size = 24, bold }: { name: IconName; color: ColorValue; size?: number; bold?: boolean }) {
  const stroke = { stroke: color, strokeWidth: bold ? 2.1 : 1.6, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path d="M3.5 10.5 12 3.8l8.5 6.7V20a.5.5 0 0 1-.5.5h-5.2v-6h-5.6v6H4a.5.5 0 0 1-.5-.5z" {...stroke} />}
      {name === 'camera' && (
        <>
          <Path d="M4 8.5h3.2l1.5-2.3h6.6l1.5 2.3H20a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0120 19.5H4A1.5 1.5 0 012.5 18v-8A1.5 1.5 0 014 8.5z" {...stroke} />
          <Circle cx="12" cy="13.6" r="3.4" {...stroke} />
        </>
      )}
      {name === 'finder' && <Path d="M3.5 5h17l-6.6 7.8v5.6l-3.8 2.1v-7.7z" {...stroke} />}
      {name === 'topics' && (
        <>
          <Rect x="3.5" y="3.5" width="7" height="7" rx="1" {...stroke} />
          <Rect x="13.5" y="3.5" width="7" height="7" rx="1" {...stroke} />
          <Rect x="3.5" y="13.5" width="7" height="7" rx="1" {...stroke} />
          <Rect x="13.5" y="13.5" width="7" height="7" rx="1" {...stroke} />
        </>
      )}
      {name === 'aid' && <Path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z" {...stroke} />}
    </Svg>
  );
}
