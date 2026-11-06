import * as Haptics from 'expo-haptics';
import { NativeTabs } from 'expo-router/native-tabs';

import { TODAY_INDEX } from '@/data/sample';
import { useApp } from '@/state/AppState';
import { C, F } from '@/theme';

const PLUS = require('../../../assets/tabs/plus.png');
const CLOSE = require('../../../assets/tabs/close.png');

/**
 * The system tab bar (Liquid Glass on iOS 26+). Today and Training share the capsule; "Log food"
 * is a third tab drawn on its own prominent surface (iOS 27+) and marked `disabled`, so tapping it
 * never changes the focused tab. Its `tabPress` still fires, and that toggles the food log.
 * The food log itself is rendered inside each screen so it sits under the floating bar.
 */
export default function TabsLayout() {
  const { addOpen, setAddOpen, setDayIndex } = useApp();

  return (
    <NativeTabs
      tintColor={C.ink}
      iconColor={{ default: C.grey, selected: C.ink }}
      labelStyle={{ default: { fontFamily: F.mono, fontSize: 10, color: C.grey }, selected: { fontFamily: F.mono, fontSize: 10, color: C.ink } }}
      minimizeBehavior="onScrollDown"
      // Switching tabs closes the food log (the log button toggles it itself).
      screenListeners={({ route }) => ({ tabPress: () => route.name !== 'log' && addOpen && setAddOpen(false) })}
    >
      <NativeTabs.Trigger
        name="index"
        disableAutomaticContentInsets
        contentStyle={{ backgroundColor: C.bg }}
        listeners={({ navigation }) => ({
          // Tapping Today while on Today jumps back to today's date.
          tabPress: () => navigation.isFocused() && setDayIndex(TODAY_INDEX),
        })}
      >
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="wb_sunny" />
        <NativeTabs.Trigger.Label>TODAY</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="training" disableAutomaticContentInsets contentStyle={{ backgroundColor: C.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
        <NativeTabs.Trigger.Label>TRAINING</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="log"
        prominent
        disabled
        accessibilityLabel={addOpen ? 'Close food log' : 'Log food'}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddOpen(!addOpen);
          },
        }}
      >
        {/* iOS colours every unselected item from the selected tab's appearance, so the orange
            comes from the image: the SF Symbols plus / xmark pre-rendered in orange. */}
        <NativeTabs.Trigger.Icon src={addOpen ? CLOSE : PLUS} renderingMode="original" />
        <NativeTabs.Trigger.Label hidden>Log food</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
