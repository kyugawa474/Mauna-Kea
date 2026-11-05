/**
 * Skia numbers every <Canvas> with a counter that restarts at 1000 each time the JS bundle loads.
 * After an in-place reload (a dev reload, or an OTA update applied with Updates.reloadAsync), the
 * new canvases can be handed IDs that the unmounting canvases from the previous load still hold
 * natively; when the old one unregisters last, the new canvas is left blank until it re-renders.
 * That is how the Today frost went missing. Starting the counter at a per-load value avoids the
 * collision.
 *
 * Imported from `src/` because Metro resolves Skia through its "react-native" entry (src/index.ts),
 * so this is the same counter object <Canvas> uses. Re-check this path when upgrading Skia.
 */
import { SkiaViewNativeId } from '@shopify/react-native-skia/src/views/SkiaViewNativeId';

// Stays well below 2^31 so it remains a valid native view tag.
SkiaViewNativeId.current = 1000 + (Date.now() % 1_000_000_000);
