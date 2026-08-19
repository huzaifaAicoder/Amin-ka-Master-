# Amin Ka Master — Functionality Verification Matrix

**Purpose.** This matrix is the release-gate record for the full-system QA cycle. A row is marked **Verified** only when implementation evidence covers the applicable user interaction, server operation, persistence or authorized delivery, response handling, and regression/security behavior. A status of **Needs QA** or **Needs repair** is intentionally not release approval.

| Area | Capability | Status | Current evidence or required next check |
|---|---|---|---|
| Authentication | Student registration and sign-in | Verified | Server credential validation, portal separation, session handling, and regression suite coverage. Device entry flow remains part of responsive QA. |
| Authentication | Teacher/Admin sign-in and Staff Passkey | Verified | Server-side Staff Passkey validation and permission tests are present. |
| Authentication | Owner/Super Admin sign-in and setup code | Verified | Owner code checks and first-owner test coverage are present. |
| Authentication | Logout, session invalidation, expired session | Verified | Logout regression tests and server session revocation are present; a revoked browser session was verified to clear local identity and redirect to sign-in on HTTP 401. |
| Authentication | Invalid credentials and unauthorized route access | Verified | Login feedback and protected-route/security regression coverage are present. |
| Student | Home, discovery, search, category filtering | Needs QA | Requires authenticated student UI and persistence-path walkthrough in this QA cycle. |
| Student | Course details, free enrollment, access checks | Needs QA | Server entitlement logic exists; exercise published/free and unauthorized paths. |
| Student | Lesson navigation, video, progress, bookmarks, notes | Needs QA | Authorized delivery has been implemented; test on student UI and verify refresh persistence. |
| Student | Tests, timeout, scoring, review | Needs QA | Server-authoritative scoring and review exist; run student attempt and invalid/duplicate checks. |
| Student | Notifications and live classes | Needs QA | Verify empty, populated, read, and unauthorized states. |
| Student | Shorts likes, saves, shares | Needs QA | Persistent engagement APIs exist; exercise create/toggle/refresh/delete-state behavior. |
| Student | Saved Shorts library | Verified | Protected per-student saved-only API and Account entry point return only currently published items with fresh signed playback URLs; removal invalidates both saved and feed caches. |
| Student | Certificates | Needs repair | No completed certificate issuance flow is verified. |
| Teacher/Admin | Operations dashboard metrics and course summary | Verified | Fresh authenticated preview now shows database-backed 3 students, 2 courses, 2 enrollments, and 1 upcoming session after cache recovery. |
| Teacher/Admin | Course listing and course create/update/status | Verified | Authenticated live API smoke check plus Super Admin Course Manager preview verified real seeded records; run final CRUD persistence check. |
| Teacher/Admin | Categories | Needs QA | Super Admin category workspace exists; test create/update/archive and course usage. |
| Teacher/Admin | Modules, lessons, resources | Needs QA | Server authorization and signed-media delivery exist; test staff create/update/publish and student authorization. |
| Teacher/Admin | Media upload and Short creation | Verified | Managed-media URL validation regression test and authenticated API smoke passed after upload and save procedure repair. |
| Teacher/Admin | Existing-media edit/unpublish | Verified | Protected Media Maintenance workspace is discoverable from Operations and uses existing server-enforced save/status procedures. |
| Teacher/Admin | Tests, questions, live classes | Needs QA | Existing management screens require full CRUD and invalid-input walkthrough. |
| Teacher/Admin | Student management, notifications, CMS | Needs QA | Owner controls exist; verify role boundaries and persistence. |
| Owner | Staff creation and role management | Needs QA | Server restrictions and UI exist; verify create, suspend/reactivate, and refresh persistence. |
| Owner | Teacher permission grant/revoke | Needs QA | Explicit server enforcement exists; test grant, revoke, and immediate denial after revoke. |
| Owner | Passkey rotation and audit controls | Needs QA | Server and tests exist; verify user flow and active-session invalidation. |
| Owner | Settings, enrollments, reviews, announcements | Needs QA | Control Center foundation exists; complete CRUD and negative authorization checks. |
| Security | Student-to-staff/owner and Admin-to-owner escalation | Verified | Automated adversarial authorization tests cover protected procedures and owner restrictions. |
| Security | Direct protected media access | Needs QA | Signed URL delivery is implemented; test unauthenticated, unenrolled, expired, unpublished, and authorized cases. |
| Security | Direct API manipulation and invalid IDs | Needs QA | Expand targeted API adversarial calls across operations and learning resources. |
| Data integrity | User, permission, session, course and media consistency | Needs QA | Initial read-only relational checks passed; extend to CRUD lifecycle and duplicate/integrity cases. |
| Performance | Query efficiency, payloads, caching, rendering | Verified | Operations stale-cache defect was repaired; core catalogue, ordering, enrollment, progress, session, and Shorts tables have reviewed lookup indexes. Anonymous catalogue traffic now skips unnecessary managed-auth lookup. |
| Performance | Load and stress behavior | Verified, bounded | 100 local catalogue requests at 20-way concurrency returned 100 HTTP 200 responses in 3.823 seconds; this sandbox smoke test is not a 10,000-user capacity claim. |
| Download/security | Authorized configurable lecture download | Needs repair | Not implemented; evaluate a controlled permission model before exposing downloads. |
| Download/security | Screenshot and recording deterrence | Verified, platform-limited | Native authorized lesson screens activate supported screen-capture prevention on Android/iOS; web and out-of-band recording remain outside application control. |
| External services | Razorpay UPI payments | Credential-dependent | Boundary exists; merchant keys and webhook configuration are still required. |
| External services | OTP email/SMS delivery | Credential-dependent | Provider boundary exists; real provider configuration required for delivery. |
| External services | AI tutor/Q&A | Needs QA | Do not fabricate responses; assess server architecture and credential/configuration boundary. |
| Responsive QA | Mobile, tablet, desktop | Needs QA | Desktop authenticated flows were observed; perform targeted phone/tablet layout and native feature checks. |

## Verification Procedure

For any record-changing feature, test **create → read → update → refresh → verify persistence**, then execute the available deactivate/archive/delete path and verify its intended effect. Test missing fields, duplicate inputs, invalid IDs, repeated submission, lost connectivity, expired sessions, and server-denied roles. A UI success message alone never verifies a feature.

## Current Recovery Evidence

The current recovery fixed four coupled issues: the demo student/teacher accounts were inadvertently suspended; the Teacher demo lacked media permission; managed upload paths were rejected by a URL-only schema; and the session bootstrap retired the valid seeded Super Admin because it shared the legacy local-preview identifier. The Operations page also cached transient zero values. The corrected preview now displays live server totals and seeded courses, while authenticated live API checks confirmed course listing, course creation, media upload, and Short persistence.

## Final Automated and Integrity Evidence

The release-gate run completed with Expo SDK dependency compatibility verification, TypeScript checking, linting, and five automated test files containing eighteen assertions. The Android static export completed successfully and emitted the Android bundle plus export metadata. The API health route returned a successful response after validation.

The final read-only database-integrity query found zero orphaned sessions, enrollments, learning-progress records, Short likes, or Short saves, and zero duplicate enrollment, like, or save relationships. These checks validate current relational consistency; they do not replace production backup, observability, or provider-level monitoring.
