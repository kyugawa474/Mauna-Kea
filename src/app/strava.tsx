import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { STRAVA_CLIENT_ID } from '@/data/strava';
import { useApp } from '@/state/AppState';
import { themed, useTheme } from '@/state/Theme';
import { DT, F, T, useLayout, type Palette } from '@/theme';

// Closes the auth popup when this screen loads inside it (web only; a no-op on iOS).
WebBrowser.maybeCompleteAuthSession();

const discovery = {
  // The mobile endpoint hands off to the Strava app when it is installed.
  authorizationEndpoint: 'https://www.strava.com/oauth/mobile/authorize',
  tokenEndpoint: 'https://www.strava.com/oauth/token',
};

/**
 * Strava only redirects to hosts inside the app's "Authorization Callback Domain", but always
 * allows localhost. So: `maunakea://localhost/strava` in builds, `exp://localhost:<port>/--/strava`
 * in Expo Go.
 */
const redirectUri = makeRedirectUri({ native: 'maunakea://localhost/strava', path: 'strava', preferLocalhost: true });

/** Connect, view and disconnect the Strava account the app reads rides from. */
export default function StravaScreen() {
  const { insets } = useLayout();
  const { C, caps } = useTheme();
  const styles = useStyles();
  const { strava, connectStrava, disconnectStrava, syncStrava, data } = useApp();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: STRAVA_CLIENT_ID,
      scopes: ['activity:read_all'],
      redirectUri,
      responseType: ResponseType.Code,
      // Strava has no PKCE; the code goes to our server, which holds the client secret.
      usePKCE: false,
      extraParams: { approval_prompt: 'auto' },
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    const { code, scope = '' } = response.params;
    if (!scope.includes('activity:read_all')) {
      // The athlete can untick scopes on Strava's page; without this one we can't read rides.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    connectStrava(code).then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }, [response, connectStrava]);

  const missingId = !STRAVA_CLIENT_ID;
  const busy = strava.status === 'connecting' || strava.status === 'loading';
  const connected = strava.status === 'connected' || strava.status === 'syncing';
  const denied = response?.type === 'error' || (response?.type === 'success' && !(response.params.scope ?? '').includes('activity:read_all'));
  const rides = data.source === 'strava' ? data.activityLog.filter((a) => a.kind === 'ride').length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.top}>
          <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.grey }]}>Data source</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text maxFontSizeMultiplier={DT.list} style={caps}>Done</Text>
          </Pressable>
        </View>
        <Text maxFontSizeMultiplier={DT.fixed} style={styles.h1}>Strava</Text>

        {!connected ? (
          <>
            <Text maxFontSizeMultiplier={DT.list} style={styles.body}>
              Your rides, kJ and power come from Strava. Until you connect, the app shows sample data.
            </Text>
            <View style={styles.rule} />
            <Row label="Reads" value="Activities, incl. private" />
            <Row label="Stored" value="On this device only" />
            <Row label="Status" value={strava.status === 'loading' ? 'Checking…' : 'Not connected'} />

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                promptAsync();
              }}
              disabled={!request || missingId || busy}
              style={({ pressed }) => [styles.primary, (missingId || !request) && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color={C.onAccent} /> : <Text maxFontSizeMultiplier={DT.list} style={[caps, styles.primaryText]}>Connect with Strava</Text>}
            </Pressable>
            {missingId && (
              <Text maxFontSizeMultiplier={DT.list} style={styles.note}>
                No client ID yet: set EXPO_PUBLIC_STRAVA_CLIENT_ID in .env.local (see .env.example) and restart Metro.
              </Text>
            )}
            {denied && <Text maxFontSizeMultiplier={DT.list} style={[styles.note, { color: C.accentText }]}>Strava didn’t grant activity access. Connect again and leave “View data about your private activities” ticked.</Text>}
            {strava.message && <Text maxFontSizeMultiplier={DT.list} style={[styles.note, { color: C.accentText }]}>{strava.message}</Text>}
          </>
        ) : (
          <>
            <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.grey, marginTop: 8 }]}>Connected as</Text>
            <Text maxFontSizeMultiplier={DT.fixed} style={styles.name}>{strava.athlete}</Text>
            <View style={styles.rule} />
            <Row label="Status" value={strava.status === 'syncing' ? 'Syncing…' : 'Up to date'} />
            <Row label="Last sync" value={strava.syncedAt ? new Date(strava.syncedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—'} />
            <Row label="Rides this week" value={String(rides)} />
            {strava.message && <Text maxFontSizeMultiplier={DT.list} style={[styles.note, { color: C.accentText }]}>{strava.message}</Text>}

            <View style={styles.buttons}>
              <Pressable onPress={syncStrava} disabled={strava.status === 'syncing'} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]} accessibilityRole="button">
                {strava.status === 'syncing' ? <ActivityIndicator color={C.ink} /> : <Text maxFontSizeMultiplier={DT.list} style={caps}>Sync now</Text>}
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  disconnectStrava();
                }}
                style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityHint="Removes your Strava tokens and cached rides from this device"
              >
                <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.accentText }]}>Disconnect</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text maxFontSizeMultiplier={DT.list} style={[caps, styles.powered]}>Powered by Strava</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { C, caps } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text maxFontSizeMultiplier={DT.list} style={[caps, { color: C.grey }]}>{label}</Text>
      <Text maxFontSizeMultiplier={DT.list} style={styles.value}>{value}</Text>
    </View>
  );
}

const useStyles = themed((C: Palette) => StyleSheet.create({
  page: { paddingTop: 20, paddingHorizontal: 20, gap: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { fontFamily: F.semibold, fontSize: T.head, letterSpacing: -1.2, lineHeight: 44, color: C.ink },
  body: { fontFamily: F.medium, fontSize: T.body, lineHeight: 22, color: C.ink },
  name: { fontFamily: F.light, fontSize: T.mid, letterSpacing: -0.5, color: C.ink },
  note: { fontFamily: F.mono, fontSize: T.label, lineHeight: 16, color: C.grey },
  rule: { height: 1, backgroundColor: C.ink, marginHorizontal: -20, marginTop: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  value: { fontFamily: F.medium, fontSize: T.body, color: C.ink, flexShrink: 1, textAlign: 'right' },
  primary: { marginTop: 20, height: 52, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: C.onAccent, fontFamily: F.monoMedium },
  buttons: { flexDirection: 'row', gap: 3, marginTop: 20 },
  secondary: { flex: 1, height: 48, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' },
  powered: { color: C.grey, marginTop: 28, textAlign: 'center' },
}));
