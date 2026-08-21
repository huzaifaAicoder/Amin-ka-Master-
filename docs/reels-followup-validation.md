# Reels Follow-up Validation

## Additive changes

The Reels feed now derives a small subject filter from existing Short title and description text. This is a local presentation filter; it does not alter published Short records or create a second subject taxonomy. The Reels Hub now cycles Recent, Name, and Size sorting over the existing Liked, Saved, and Offline collections. Offline storage totals are calculated from actual files found under the existing private `protected-resources/` directory; no quota or availability is fabricated.

## Android/iOS validation checklist

Use an authenticated Android/iOS build. In Shorts, verify the subject chips can be swiped horizontally and selecting Surveying, Land Records, Amin Exam, Mathematics, or General changes only the visible feed items. Confirm one active item plays at a time, the feed still pages one item at a time, and pull-to-refresh preserves the selected filter.

On Android and iOS, open Ask AI, tap directly in the composer, and verify the text cursor and software keyboard appear without covering the active input. Test the same flow after attaching and removing an image, after choosing a suggested follow-up, and after scrolling a long conversation. The composer must remain visible above the keyboard and tap-to-focus must not open the image picker or send a message.

In Shorts, swipe through several managed and external entries. Each swipe must settle on exactly one full-height Reel; inactive managed videos must pause and only the visible active item may play. The title and social controls stay over the video rather than extending the page into the next Reel. Tap Share for a managed Short and an external Short: the native share sheet should receive the title/description, and external items should also include their provider URL. The Download action appears only for managed items on Android/iOS; external and browser items do not offer a misleading download. For a managed item, confirm one press shows Saving, a completed private file appears only after success, and a failed attempt remains retryable from Downloads.

Open Account → Reels Hub. Verify Recent, Name, and Size sorting changes ordering without changing server likes or saves. Open Offline and confirm the displayed private-storage total equals the visible completed files; open a managed video through the existing internal viewer. Confirm external URLs do not expose a Download action and remain subject to the existing provider fallback.

Force a managed Short download interruption, then retry it from Downloads. Confirm a fresh authorization request is made, no pending file appears as completed, and the finished file appears in both Downloads and Reels Hub → Offline. Confirm Student capture protection remains active while viewing protected media.

## Evidence boundary

Browser preview and automated tests verify source wiring, category inference, sorting, file-size calculation, protected paths, and role-safe routing. They cannot prove physical magnetometer behavior, Android/iOS WebView policy responses, screenshot/recording blocking in a standalone build, or actual interrupted filesystem behavior. Those require the authenticated device checklist above.
