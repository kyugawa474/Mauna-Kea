import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useApp } from '@/state/AppState';
import { C } from '@/theme';

/**
 * Backs the "Log food" button in the tab bar. The tab is `disabled`, so tapping it never lands
 * here; it only toggles the food log. If something navigates here anyway (a deep link), open the
 * food log over Today instead of showing an empty screen. Native tabs mount every screen up front,
 * so this checks real focus rather than reacting to the mount.
 */
export default function LogRoute() {
  const focused = useIsFocused();
  const { setAddOpen } = useApp();
  useEffect(() => {
    if (!focused) return;
    router.replace('/');
    setAddOpen(true);
  }, [focused, setAddOpen]);
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
