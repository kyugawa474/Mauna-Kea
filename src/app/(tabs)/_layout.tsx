import * as Haptics from 'expo-haptics';
import { NativeTabs } from 'expo-router/native-tabs';

import { useApp } from '@/state/AppState';
import { useTheme } from '@/state/Theme';
import { F } from '@/theme';

const PLUS = require('../../../assets/tabs/plus.png');
const CLOSE = require('../../../assets/tabs/close.png');
// White copies for dawn, dusk and night, when white is the accent (scripts/tint-png.swift).
const PLUS_WHITE = require('../../../assets/tabs/plus-white.png');
const CLOSE_WHITE = require('../../../assets/tabs/close-white.png');
// SF Symbols `circle` and `circle.hexagonpath` at Light weight, pre-rendered because the native tab
// icon has no weight option (scripts/render-sf-symbol.swift). Template mode lets the bar tint them.
const TODAY = require('../../../assets/tabs/today.png');
const TRAINING = require('../../../assets/tabs/training.png');

/**
 * The system tab bar (Liquid Glass on iOS 26+). Today and Training share the capsule; "Log food"
 * is a third tab drawn on its own prominent surface (iOS 27+) and marked `disabled`, so tapping it
 * never changes the focused tab. Its `tabPress` still fires, and that toggles the food log.
 * The food log itself is rendered inside each screen so it sits under the floating bar.
 */
export default function TabsLayout() {
  const { addOpen, setAddOpen, setDayIndex, data } = useApp();
  const { C, scheme } = useTheme();
  const dark = scheme === 'dark';

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
          tabPress: () => navigation.isFocused() && setDayIndex(data.todayIndex),
        })}
      >
        <NativeTabs.Trigger.Icon src={TODAY} renderingMode="template" />
        <NativeTabs.Trigger.Label hidden>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="training" disableAutomaticContentInsets contentStyle={{ backgroundColor: C.bg }}>
        <NativeTabs.Trigger.Icon src={TRAINING} renderingMode="template" />
        <NativeTabs.Trigger.Label hidden>Training</NativeTabs.Trigger.Label>
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
            comes from the image: the SF Symbols plus / xmark pre-rendered in orange (white after dark). */}
        <NativeTabs.Trigger.Icon src={addOpen ? (dark ? CLOSE_WHITE : CLOSE) : dark ? PLUS_WHITE : PLUS} renderingMode="original" />
        <NativeTabs.Trigger.Label hidden>Log food</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
