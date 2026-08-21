# Reels Performance and Student Hub Delivery

## Preservation rule

This upgrade is additive. The existing Shorts feed, screen-capture guard, published/pending moderation workflow, comments, likes, saves, sharing, external-provider fallback, protected course Downloads, internal viewers, Student feature flags, authentication, and role boundaries remain in place.

## Delivered behavior

| Area | Implementation | Safety and compatibility boundary |
|---|---|---|
| **Feed performance** | Kept `FlatList` paging, start alignment, fast deceleration, refresh control, active-item viewability, and active managed-player autoplay. Reduced the render window, batch size, and batch interval; added deterministic `getItemLayout`. | Only the focused managed item is played. Inactive managed players are paused. The feed does not create a second media engine or a second Shorts route. |
| **External playback** | YouTube/Instagram embeds remain WebView/iframe-backed. YouTube URLs now show a thumbnail while inactive and mount the embed only when the item becomes active. Existing provider navigation filtering, retry fallback, and share-link action remain. | Provider playback is not guaranteed by the external platform. Failures show a native retry/fallback state rather than fake playback. |
| **Social action bar** | Retained Like, Comment, Share, and Save and added Download. | Download requests are available only for `managed` Shorts. External YouTube/Instagram media displays the existing clean “External media cannot be downloaded directly” message. |
| **Offline Short downloads** | Added a Student-protected `requestShortDownload` route that verifies a published managed Short and issues a fresh signed storage URL. The existing completion-only helper promotes a verified file from a pending path into private `protected-resources/`. | External URLs, unpublished media, missing storage keys, incomplete files, and unauthorized roles are rejected. Failed Reel records retain only local ID/title/kind/message/source and retry through the correct Short route. |
| **Student Reels Hub** | Added `Reels Hub` to Account with Liked, Saved, and Offline tabs. Liked and Saved use server-persisted records. Offline scans the existing private folder and opens the existing internal video/PDF viewers. | The existing Saved Shorts screen remains available. No public cache, browser handoff, new media table, or client-only social truth was introduced. |

## Validation

TypeScript passed. The full regression suite passed with **100 tests across 26 files**. Lint passed with 4 pre-existing hook warnings in the lesson and moderation screens and no new errors. The preview services restarted successfully. The preview screenshot endpoint was unavailable after restart, so authenticated physical-device playback and native offline storage still require manual Android/iOS verification.

## Manual device runbook

On an authenticated Android/iOS build, open Shorts, confirm only the visible managed item plays, swipe through three items, pull to refresh, open an external YouTube item, verify thumbnail-first loading and fallback retry, tap Download on a managed item, confirm it appears in Reels Hub → Offline and Downloads, then force an interrupted transfer and verify Retry completes only a new private file. Confirm screenshots/recording remain blocked and external Download shows the clean rejection message.
