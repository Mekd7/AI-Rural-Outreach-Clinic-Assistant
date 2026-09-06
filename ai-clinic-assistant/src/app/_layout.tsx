import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { initDatabase } from '@/db/client';

export default function RootLayout() {
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
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="consultation/[id]" />
      <Stack.Screen name="consultation/view/[id]" />
      <Stack.Screen name="consultation/edit/[id]" />
      <Stack.Screen name="patient/edit/[id]" />
      <Stack.Screen name="handover" />
    </Stack>
  );
}
