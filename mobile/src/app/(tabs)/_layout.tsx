// 底部五个入口，和网站的手机底栏一致：首页、识别、检索、专题、急救。急救一直是红色。
// 底栏的选中色取自当前页面的设置、对所有入口生效，所以急救的红色写在它自己的图标和文字上。
import { Tabs } from 'expo-router/tabs';
import { Icon, type IconName } from '@/components/Icon';
import { useColors } from '@/lib/theme';

const TABS: [name: string, title: string, icon: IconName][] = [
  ['index', '首页', 'home'],
  ['identify', '识别', 'camera'],
  ['finder', '检索', 'finder'],
  ['topics', '专题', 'topics'],
  ['aid', '急救', 'aid'],
];

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentInk,
        tabBarInactiveTintColor: c.ink3,
        tabBarStyle: { backgroundColor: c.paper, borderTopColor: c.rule },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: c.paper },
      }}
    >
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            ...(name === 'aid' ? { tabBarLabelStyle: { fontSize: 11, color: c.toxic } } : {}),
            tabBarIcon: ({ color, focused }) => <Icon name={icon} color={name === 'aid' ? c.toxic : color} bold={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
