# Authenticated Role and Digital Wellbeing QA Runbook

## Purpose

This runbook covers the two remaining follow-up checks: verifying that real lesson activity appears as private Wellbeing data, and validating Student, Teacher/Admin, Owner, and Developer navigation on authenticated Android/iOS devices. Browser preview and automated tests can verify source boundaries and route wiring, but they cannot replace device credentials, native keyboard behavior, protected storage, screen-capture deterrence, camera permissions, or provider playback checks.

## Digital Wellbeing verification

| Step | Role | Action | Expected result |
|---|---|---|---|
| 1 | Student | Open Account → Digital Wellbeing, record the initial Today and Last 7 days values. | The screen loads privately and shows zero or existing local totals without fabricated numbers. |
| 2 | Student | Open an authorized lesson and remain on the active lesson screen for at least 35 seconds. Background the app, return, then exit the lesson. | The existing lesson lifecycle records the bounded interval under the Lectures category. |
| 3 | Student | Reopen Digital Wellbeing and pull to refresh. | Today increases by approximately the supported active interval; the Lectures row shows the recorded time. Short intervals under the 30-second threshold are not recorded. |
| 4 | Student | Open Study Coach and tap the Weekly learning time graph. | The graph navigates to the same Wellbeing Details route and shows the same local totals. |
| 5 | Student | Sign out and sign in again on the same device. | Local wellbeing data remains available for the same Student account; no staff-facing endpoint receives it. |

Existing historical numeric records remain readable as Lectures for backward compatibility. Notes, Shorts, Tests, and Other remain zero until category-aware activity sources are deliberately instrumented; the UI does not invent category minutes.

## Authenticated role matrix

| Role | Entry | Must be available | Must be denied or hidden |
|---|---|---|---|
| Student | Student sign-in | Home, Explore, Courses, Learning, Shorts, Downloads, AI, AI Quiz, Toolkit, Tests, Live, Notifications, Account, Wellbeing | Operations, Owner controls, Developer Portal |
| Teacher/Admin | Staff sign-in plus Staff Passkey | Courses/content, tests, live classes, student operations, allowed moderation and learning operations | Owner Business Intelligence, master settings, staff creation, audit/security controls, Developer Portal |
| Owner | Owner sign-in plus Owner code/passkey | Staff/student management, courses, pricing, business intelligence, CMS, settings, feature controls, audit and broadcast controls | Developer-only portal and root credentials |
| Developer | Developer sign-in plus server-verified Developer Passkey | Developer Control Center, client/template controls, feature matrix, maintenance, audit, preview and release preparation | No bypass of server authentication; provider secrets remain server-side |

## QA evidence status

Automated source and regression validation is completed in the project test suite. Physical Android/iOS execution requires the user’s authenticated device sessions and should be recorded as GREEN only after each row is manually observed. Any provider, permission, storage, keyboard, or capture failure should be recorded with the device model, OS version, route, and a reproducible step rather than replaced with mock success.
