# Full-System Forensic Stabilization Audit

**Project:** Amin Ka Master  
**Audit type:** Preservation-first forensic QA and zero-regression stabilization  
**Scope:** Existing mobile application, tRPC API, MySQL data, RBAC, route guards, offline media, Shorts/Reels, AI learning, Staff/Owner operations, and Developer controls.  
**Audit rule:** Existing systems were inspected before modification. Repairs were limited to confirmed defects; no feature, route, schema, or valid user data was reset or replaced.

## Executive outcome

The forensic audit found **six confirmed defects**. Each one was repaired with a narrow change and regression coverage. The complete static and API-oriented suite now passes: **133 tests in 37 files**, TypeScript passes, and lint reports **four pre-existing warnings with no errors**.

| Area | Result | Evidence |
|---|---:|---|
| Student learning, AI, offline, Toolkit, Reels, tests, language, and wellbeing | GREEN (automated) | 43 focused tests across 12 Student suites passed. |
| Staff, Owner, Developer, white-label, telemetry, and route recovery | GREEN (automated) | 30 focused tests across 11 operator suites passed. |
| Full regression suite | GREEN | 133 tests in 37 files passed. |
| TypeScript | GREEN | `pnpm exec tsc --noEmit` passed. |
| Lint | GREEN with known warnings | 0 errors; 4 existing hook-dependency warnings remain. |
| Physical Android/iOS workflow checks | PENDING USER DEVICE QA | Requires real authenticated accounts, Expo Go/native builds, and device-only sensor/media/capture behavior. |

## Preserved system inventory

The audit mapped the existing four-role design, the Expo Router route tree, the root authentication gate, the tRPC router groups, and 45 application tables. Existing areas preserved in place include the Student dashboard and learning path; protected lessons, downloads, and local viewers; AI Doubt Solver image flow; AI Quiz, timed tests, result export, and history; Reels/Shorts, moderation, likes, saves, comments, managed downloads, and external-provider handling; Amin Toolkit; Study Coach and wellbeing; live classes; Staff operations; Owner controls; Developer Control Center; white-label templates; audit logs; privacy-preserving telemetry; authentication and password recovery.

| Role | Intended route surface | Server boundary retained |
|---|---|---|
| Developer | `/dev-portal`, `/view-as` | `requireRoles(["developer"])` and server-only passkey verification. |
| Owner | `/operations`, `/operations/control`, role-aware Account | Owner code login and `ownerProcedure` for owner-only controls. |
| Staff/Admin | `/operations` and delegated management areas | Staff passkey plus role and delegated-permission checks. |
| Student | Tabs and Student learning routes | Root route guard plus Student-only server procedures for private learner actions. |

## Confirmed defects and repairs

| ID | Confirmed finding | Narrow restoration | Regression evidence |
|---|---|---|---|
| F-01 | Several private Student API procedures accepted any authenticated role; several top-level Student routes were absent from the root Student-route list. | Added reusable `studentProcedure` middleware and applied it to the previously broad Student endpoints. Expanded the existing root list for AI, performance, Reels Hub, saved Shorts, free playlists, certificates, offline viewers, and wellbeing details. The role-aware Account-tab exception remains intact. | `lms.security.test.ts`, `forensic-stabilization-repair.test.ts`, `staff-account-route-recovery.test.ts`. |
| F-02 | The generic Staff login procedure allowed an Owner account to authenticate with a Staff passkey, bypassing the Owner code flow. | Explicitly reject `super_admin` accounts in generic Staff login; Owner authentication remains in the existing Owner Portal path. | `forensic-stabilization-repair.test.ts` and existing Owner/passkey coverage. |
| F-03 | The Operations single-test read procedure checked the role but not the delegated `assessments.manage` grant. | Added the existing delegated permission check to the read procedure. | `lms.security.test.ts`. |
| F-04 | Developer Portal’s “Student Shorts upload” switch altered the unrelated Shorts visibility override instead of the server-backed `canUploadShorts` capability. | Wired the existing `developer.setUserControls` mutation with `canUploadShorts`. | `forensic-stabilization-repair.test.ts`. |
| F-05 | Reels Hub showed a misleading external-media placeholder instead of rendering the established provider embed behavior. | Extracted the established YouTube/Instagram inline player into one shared component used by Shorts and Reels Hub. If a provider rejects embedding, the Hub now exposes a truthful “Open provider” action rather than claiming inline playback is available. | `reels-hub.test.ts`, `youtube-embed.test.ts`, `production-hardening.test.ts`. |
| F-06 | One enrollment, one lesson-progress row, and one test-attempt row referenced nonexistent user ID `30001`. | Verified no dependent test-answer rows and removed only those three proven orphan records in a transaction. No user, course, or valid activity record was deleted. Post-repair integrity counts are zero. | Read-only pre/post integrity queries recorded during this audit. |

## API and security findings

The restoration applies defense in depth. The user-interface redirect prevents non-Students from entering Student-only screens, while the new server middleware rejects non-Student callers before private data is returned or mutated. The Staff/Owner Account restoration remains separate: `/(tabs)/account` continues to be excluded from the non-Student tab redirect, while all other Student tabs and standalone Student routes remain blocked.

The Owner authentication repair does not reduce Owner operational authority. It only ensures that an Owner must use the intended Owner Portal and Private Owner Passkey/Code rather than a lower-assurance generic Staff sign-in endpoint. Developer and Staff passkey behavior is otherwise preserved.

## Database validation and reconciliation

The database contained 45 application tables plus the migration table. A read-only integrity pass checked representative user, course, lesson, enrollment, assessment, session, like, save, and comment relationships. Before reconciliation, only three user-reference checks were nonzero, all for nonexistent user ID `30001`. The related enrollment, progress, and in-progress attempt had no dependent answer rows; they were safely removed in a transaction. The same checks now return zero orphan rows.

> The audit did not reset the database, reseed data, alter the schema, or delete any record attached to an existing user.

## Validation detail

| Validation layer | Command or method | Outcome |
|---|---|---|
| Student-focused regression | Twelve focused suites | 43 tests passed. |
| Operator-focused regression | Eleven focused suites | 30 tests passed. |
| Repair-focused regression | Seven focused suites | 48 tests passed. |
| Full regression | `pnpm test` | 133 tests passed across 37 files. |
| Type check | `pnpm exec tsc --noEmit` | Passed. |
| Lint | `pnpm lint` | Passed with four pre-existing React hook-dependency warnings and zero errors. |
| Database integrity | Read-only joins before and after reconciliation | All audited orphan checks now return zero. |

## Remaining validation boundaries

The sandbox cannot truthfully perform authenticated physical Android/iOS testing or device-only behavior such as GPS accuracy, compass calibration, camera permission prompts, screenshot/recording behavior, native file viewers, the share sheet, backgrounding, external WebView provider policy, or real role-session switching. These are documented in `docs/authenticated-role-qa-runbook.md` and must be run with real Student, Staff/Admin, Owner, and Developer accounts on actual Android and iOS devices.

External provider playback remains subject to YouTube and Instagram device, account, region, provider policy, and embed availability. The application now attempts inline playback through the shared in-app player and presents a truthful external-provider action only if the provider refuses the embed.

## Files changed by this stabilization pass

| File | Purpose |
|---|---|
| `server/_core/trpc.ts` | Added reusable Student-role middleware. |
| `server/routers.ts` | Closed Student API, Owner generic-login, and delegated test-read gaps. |
| `app/_layout.tsx` | Covered confirmed direct Student-route entries while preserving role-aware Account access. |
| `app/dev-portal.tsx` | Corrected Student Shorts-upload capability wiring. |
| `components/external-media-player.tsx` | Shared existing provider embed policy across Shorts and Reels Hub. |
| `app/(tabs)/shorts.tsx` | Reused the shared external player without changing its feed behavior. |
| `app/reels-hub.tsx` | Replaced the misleading external placeholder with inline playback and a truthful fallback. |
| `tests/forensic-stabilization-repair.test.ts` | Added focused preservation coverage. |
| `tests/lms.security.test.ts` | Added server-boundary coverage for repaired endpoints. |
| `tests/ai-quiz-progress-and-shorts-mobile.test.ts` | Updated extracted-player coverage. |
| `tests/production-hardening.test.ts` | Updated extracted-player coverage. |
| `todo.md` | Recorded the audit and completed repairs. |

## Completion statement

This pass completed the requested forensic audit and repaired every confirmed defect discovered through source inspection, API/RBAC review, data inspection, and automated regression testing. The project remains additive and preservation-first: existing screens, role surfaces, data tables, and feature systems were retained. The only remaining work is device-based QA that cannot be simulated faithfully from the sandbox.
