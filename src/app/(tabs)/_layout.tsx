import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { AddPanel } from '@/components/AddPanel';
import { NavBar } from '@/components/NavBar';
import { C } from '@/theme';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Tabs
        tabBar={(props) => <NavBar {...props} />}
        screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: C.bg } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Today' }} />
        <Tabs.Screen name="training" options={{ title: 'Training' }} />
      </Tabs>
      <AddPanel />
    </View>
  );
}
