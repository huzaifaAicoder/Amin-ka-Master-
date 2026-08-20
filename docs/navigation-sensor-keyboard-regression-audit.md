# Navigation, Sensor, and Keyboard Regression Audit

## Scope

This repair is additive. The existing Expo Router routes, four-tier session model, Staff and Developer passkey checks, Gemini Vision image pathway, AI chat history, Student Toolkit permissions, and protected media flows remain intact.

## Root cause and repair

| Reported symptom | Root cause | Targeted repair |
|---|---|---|
| `REPLACE` action for `auth` was not handled | The authentication gate conditionally removed the root Stack while its redirect effect could run during session hydration, leaving no mounted route registry for the redirect. | The Stack now remains mounted beneath a full-screen transition overlay. Redirect effects and role rules remain unchanged, but the navigator is registered before a redirect may execute. |
| Compass UI lag | Sensor callbacks drove React heading state and the compass transform directly. On devices with frequent callbacks, this can create excessive JS/UI updates. | The compass uses a 200 ms sensor interval, limits heading-text state changes to once per 250 ms, and drives needle rotation with `Animated.timing` and the native driver. The subscription is removed on stop/unmount. |
| AI composer overlapped by keyboard after image attachment work | The chat's flexible message area and the image-preview/composer group were siblings without a dedicated full-height shell. | `KeyboardAvoidingView` now owns a `flex: 1` chat shell containing messages and the camera-enabled composer area. Android uses `height`; iOS uses `padding`; the image preview stays directly above the composer. |

## Validation

TypeScript passed. The full suite passed with 84 tests across 22 files. The focused source guards now verify the mounted Stack transition design, native-driven compass animation/throttling, and complete keyboard-aware chat shell. Lint reports only four pre-existing warnings in lesson and moderation code; the new compass warning was eliminated.

## Manual device boundary

The refreshed preview renders the public entry route. Authenticated Android/iOS verification is still needed for actual keyboard inset behaviour and real magnetometer response; the browser preview does not provide a device magnetometer or native soft keyboard.
