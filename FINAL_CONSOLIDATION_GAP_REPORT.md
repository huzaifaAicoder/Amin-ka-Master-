# Final Consolidation — Forensic Feature Gap Report

**Method.** The active route tree, server/router code, Drizzle schema, migrations, test suite, and advanced checkpoint `2b10676e` were compared before implementation. No files exist only in the advanced checkpoint, so the current application retains the recovered advanced route inventory. The gap list below identifies **confirmed absent capabilities**, not merely screens that are hidden by role or feature flag.

| Feature family | Current evidence | Current status | Action |
|---|---|---|---|
| Authentication, role separation, sessions, passkeys | Auth routes, role-aware server procedures, security tests | Present | Complete authenticated role walkthroughs before release. |
| Student Home, Explore, Learning, Shorts, Downloads, Account | Current six-tab route tree | Present | Verify on enrolled Student device session. |
| Course, lesson, progress, protected PDFs/videos | Course/resource routes, authorization helper, private viewers | Present | Managed video restored; test device interruption and viewer behavior. |
| Shorts, moderation, comments, likes, saves, sharing | Student and Operations routes, social tables | Present | Android YouTube retest remains pending; Instagram device success reported. |
| AI Doubt Solver | Student screen, secure server route, Gemini boundary test | Present | Attachment/multimodal inputs are not evidenced; treat as missing until safely designed. |
| Tests, timed attempts, explanations, history | Test routes and attempts/questions tables | Present | Authenticated Teacher/Student CRUD test remains required. |
| Live classes, notifications, free playlists, certificates | Current routes/tables/procedures | Present | Complete role-based workflow test. |
| Developer Portal, feature flags, root user controls, maintenance | Developer route, managed settings, audit helpers | Present | Confirm setting propagation and Developer bypass on devices. |
| Payments/premium boundary | Orders/payment event tables and configuration paths | Configuration-ready | Do not claim live payments until provider credentials/webhook verification are configured. |
| AI Quiz generator | No route, procedure, table, or advanced-checkpoint-only implementation found | Missing | P1 candidate; requires secure AI output review workflow before publishing. |
| Snap/Quick Capture | No route, procedure, or table found | Missing | P1 candidate; requires camera permission, local storage, and AI-attachment boundary. |
| Trackers | No route, procedure, or table found | Missing | P1 candidate; requires domain model before implementation. |
| Maps & Land Records / Bihar Bhumi | No route or server integration found | Missing | P1 candidate; use official external links and never scrape/bypass controls. |
| Land converter and GPS area tool | No route, procedure, table, or checkpoint-only file found | Missing | P1 candidate; requires explicit regional profiles and transparent GPS permissions. |
| Case studies, leaderboard, restore UI | No source evidence found | Missing | P2 candidates unless product priority is raised. |

## Reconciliation decision

The next implementation work must not rebuild existing learning, Shorts, offline, AI, test, live-class, authentication, or Developer systems. The confirmed missing utility/AI expansion features are separate increments with new domain models and verification. P0 remains: authenticated role flow, offline media, YouTube Android playback, navigation, and feature-flag propagation validation.
