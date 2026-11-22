import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useColors } from '@/lib/theme';

export default function RootLayout() {
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.paper, card: c.paper, text: c.ink, border: c.rule, primary: c.accent } };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: c.accentInk,
          headerTitleStyle: { color: c.ink },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.paper },
          contentStyle: { backgroundColor: c.paper },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="s/[id]" options={{ title: '' }} />
        <Stack.Screen name="topic/[slug]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
