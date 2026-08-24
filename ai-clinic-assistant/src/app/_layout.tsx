import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';

import { initDatabase } from '@/db/client';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => {
        setDbReady(true);
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        Alert.alert(
          'Database Error',
          'Unable to initialize local storage. Some features may not work offline.',
        );
        setDbReady(true);
      });
  }, []);

  if (!dbReady) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <></>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="consultation/[id]" />
        <Stack.Screen name="consultation/view/[id]" />
        <Stack.Screen name="consultation/edit/[id]" />
        <Stack.Screen name="patient/edit/[id]" />
      </Stack>
    </ThemeProvider>
  );
}
