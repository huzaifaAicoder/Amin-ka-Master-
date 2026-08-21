# Authenticated Role and Digital Wellbeing QA Runbook

## Purpose

This runbook covers the two remaining follow-up checks: verifying that real lesson activity appears as private Wellbeing data, and validating Student, Teacher/Admin, Owner, and Developer navigation on authenticated Android/iOS devices. Browser preview and automated tests can verify source boundaries and route wiring, but they cannot replace device credentials, native keyboard behavior, protected storage, screen-capture deterrence, camera permissions, or provider playback checks.

## Digital Wellbeing verification

| Step | Role | Action | Expected result |
|---|---|---|---|
| 1 | Student | Open Account → Digital Wellbeing, record the initial Today and Last 7 days values. | The screen loads privately and shows zero or existing local totals without fabricated numbers. |
| 2 | Student | Open an authorized lesson and remain on the active lesson screen for at least 35 seconds. Background the app, return, then exit the lesson. | The existing lesson lifecycle records the bounded interval under the Lectures category. |
| 3 | Student | Reopen Digital Wellbeing and pull to refresh. | Today increases by approximately the supported active interval; the Lectures row shows the recorded time. Short intervals under the 30-second threshold are not recorded. |
| 4 | Student | Focus a private lesson note for at least 35 seconds, then tap outside the editor. | The bounded active interval is added under Notes. Text content itself is never copied into Wellbeing data. |
| 5 | Student | Complete or time-expire a protected timed test with at least 30 seconds elapsed. | The server-confirmed elapsed duration is added once under Tests after a final result is received. |
| 6 | Student | Keep one active Short on screen for at least 35 seconds, then swipe to the next Short or leave the feed. | The bounded active interval is added under Shorts. Background or off-screen items do not add time. |
| 7 | Student | Open Study Coach and tap the Weekly learning time graph. | The graph navigates to the same Wellbeing Details route and shows the same local totals. |
| 8 | Student | Sign out and sign in again on the same device. | Local wellbeing data remains available for the same Student account; no staff-facing endpoint receives it. |

### Visual category bars

| Step | Role | Action | Expected result |
|---|---|---|---|
| 1 | Student | After at least two supported categories have recorded time, open Account → Digital Wellbeing. | Each category displays its exact formatted time and a proportional bar relative to the largest category for that day. Zero categories show an empty bar and no fabricated duration. |
| 2 | Student | Pull to refresh after a new supported activity interval ends. | The existing local breakdown reloads and the affected bar changes with the exact category total. No network request or Staff-facing data is created. |

Existing historical numeric records remain readable as Lectures for backward compatibility. Notes, Tests, and Shorts increase only after their documented activity thresholds are met; the UI never invents category minutes. Other remains available for future explicitly instrumented local activities.

## Performance Insights verification

| Step | Role | Action | Expected result |
|---|---|---|---|
| 1 | Student | Sign in and open Home → Performance Insights. | The screen is available only to Students and reads current course progress, completed timed-test results, AI Quiz aggregate, and Study Coach data from their existing protected sources. |
| 2 | Student | Pull to refresh, then open Test History and AI Quiz from the screen. | The screen remains responsive; the links open the existing protected routes and no performance data is written by simply viewing Insights. |
| 3 | Teacher/Admin, Owner, Developer | Attempt the `/performance` route after authenticated sign-in. | The screen returns the Student-only message and does not expose another learner’s course, test, or AI Quiz data. |
| 4 | Student on Android and iOS | Repeat the first two steps after a completed lesson or test. | Metrics reflect the existing server-backed records after refresh. Record device, OS, route, and observed values; do not mark GREEN from browser-only evidence. |

## Student interface-language verification

| Step | Role | Action | Expected result |
|---|---|---|---|
| 1 | Student | Sign in and open Home. Tap the language control showing `EN`, `हि`, or `EN/हि`. | The language state cycles English → Hindi → bilingual and the control immediately shows the active mode. |
| 2 | Student | In each mode, review the Home header, Continue Learning label, AI Doubt Solver card, Study by Topic heading, and Featured Courses heading. | English presents English labels, Hindi presents Hindi labels, and bilingual presents both labels. Course titles, learner names, teacher-entered content, and protected content are not machine-translated or changed. |
| 3 | Student | Close and reopen the application, then sign out and sign back in on the same device. | The selected interface language persists locally on the device without creating a staff-visible student-profile field. |
| 4 | Teacher/Admin, Owner, Developer | Open their existing dashboards after a Student changes language. | Their routes, role controls, and business content remain unchanged. |

## Desktop lesson curriculum verification

| Step | Role | Action | Expected result |
|---|---|---|---|
| 1 | Student | On a desktop browser at 1000px or wider, open an authorized lesson with multiple lessons in its course. | A Course curriculum panel appears beside the player, identifies the active lesson, and lists the existing ordered course sequence. |
| 2 | Student | Select a different lesson in the sidebar. | The app opens the existing authorized lesson route; access checks, protected media, notes, and progress remain unchanged. |
| 3 | Student | Repeat below 1000px and on Android/iOS. | The sidebar is absent and the original single-column mobile lesson flow remains available. |

## Authenticated role matrix

| Role | Entry | Must be available | Must be denied or hidden |
|---|---|---|---|
| Student | Student sign-in | Home, Explore, Courses, Learning, Shorts, Downloads, AI, AI Quiz, Toolkit, Tests, Live, Notifications, Account, Wellbeing | Operations, Owner controls, Developer Portal |
| Teacher/Admin | Staff sign-in plus Staff Passkey | Courses/content, tests, live classes, student operations, allowed moderation and learning operations | Owner Business Intelligence, master settings, staff creation, audit/security controls, Developer Portal |
| Owner | Owner sign-in plus Owner code/passkey | Staff/student management, courses, pricing, business intelligence, CMS, settings, feature controls, audit and broadcast controls | Developer-only portal and root credentials |
| Developer | Developer sign-in plus server-verified Developer Passkey | Developer Control Center, client/template controls, feature matrix, maintenance, audit, preview and release preparation | No bypass of server authentication; provider secrets remain server-side |

## QA evidence status

Automated source and regression validation is completed in the project test suite. Physical Android/iOS execution requires the user’s authenticated device sessions and should be recorded as GREEN only after each row is manually observed. Any provider, permission, storage, keyboard, capture, or language-persistence failure should be recorded with the device model, OS version, route, and a reproducible step rather than replaced with mock success.
