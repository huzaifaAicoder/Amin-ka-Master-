# Master Instruction Set — Implementation and Verification Report

**Scope:** This report covers the uploaded master instruction set as applied to the existing Amin Ka Master mobile LMS. The implementation extended the established Expo, tRPC, Drizzle, MySQL, opaque-session, and four-tier role model. It did **not** rebuild the application or remove the existing Shorts, LMS, moderation, assessment, or Developer Portal flows.

## 1. Changes implemented

| Phase | Implemented change | Preserved behavior |
|---|---|---|
| Phase 1 — Stability | Stabilized Shorts `FlatList` `viewabilityConfig` and `onViewableItemsChanged` with persistent references. | Existing vertical feed, managed-video playback, play/pause overlay, likes, saves, shares, comments, submission sheet, and refresh behavior remain in place. |
| Phase 1 — Course list | Confirmed `listOperationsCourses()` returns `[]` when no database is available or its join query fails, while the Operations screen renders its empty state. | Existing permission checks and managed course summary remain unchanged. |
| Phase 2 — Capture deterrence | Mounted `usePreventScreenCapture("student-session")` at the authenticated Student-session root on Android/iOS. | Existing lesson, enrolled-course, and Shorts guards remain available; Staff, Owner, and Developer sessions are not affected. |
| Phase 2 — Authorized PDFs | Replaced native cache/share and web browser launch with private `documentDirectory/protected-resources/` storage; public sharing/browser handoff is disabled. | Server-side enrollment, publication, PDF-only, managed-storage, signed-URL, and audit-event controls remain enforced. |
| Phase 2 — Provider playback | Added `react-native-webview` and source-tagged, inline YouTube/Instagram embeds for native Shorts. Provider navigation is constrained and failures stay inside the feed. | Existing managed-video player remains the default for managed Shorts; arbitrary external URLs remain server-rejected. |
| Phase 3 — Four-tier RBAC | Audited the existing Developer → Owner → Admin/Teacher → Student isolation and preserved it. | Developer remains passkey-gated and server-only; Owner remains denied Developer procedures; Developer remains denied Operations and Student routes. |
| Phase 4 — Media Studio | Added XMLHttpRequest byte progress, a visible cancellation action, and dismissible success/error feedback to the established authenticated upload flow. | Existing draft/publish mutations, 150 MB server limit, type validation, protected storage, and External URL validation remain unchanged. |
| Phase 4 — Course CMS | Added an `All / Draft / Published / Archived` dropdown filter to the existing Course Manager list. | Explicit edit-form course status selection and existing category editing remain unchanged. |
| Phase 5 — Student Short permission | Added default-false `users.canUploadShorts`, an Admin/Owner control screen, Student visibility gating, upload-endpoint enforcement, submission-endpoint enforcement, and audit records. | Existing isolated student upload namespace and pending → approve/reject moderation lifecycle remain unchanged. |
| Release-candidate recovery | Restored the consistent `d9f92094` advanced baseline after detecting that a shared rollback had left application code ahead of its schema and deleted migrations. Restored schema/migration files from that verified checkpoint only; no destructive repository reset was used. | Developer, Shorts, moderation, assessment, and upload-permission types now align again. |

## 2. Bugs discovered and fixed

| Finding | Status | Fix applied |
|---|---|---|
| Shorts could change `FlatList` viewability handler identity during a render. | **GREEN** | Replaced inline values with persistent `useRef` instances. |
| Operations course list could be treated as an application failure in an empty or failed-query condition. | **GREEN** | Confirmed server helper returns `[]`; UI retains the existing empty state and separate retry state. |
| Student Short uploads were globally visible in the UI, with no per-student business control. | **GREEN** | Added default-deny profile flag, protected management UI, upload boundary, submission boundary, and audit events. |
| Media Studio gave only generic loading feedback. | **GREEN** | Added byte percentage, progress bar, cancel control, and inline success/error feedback. |
| Provider links redirected learners outside the app. | **GREEN, platform-limited** | Native inline provider embeds replace external-app/browser redirects; provider-blocked behavior remains inside the feed. |
| Authorized PDF flow exposed a share/browser handoff. | **GREEN, partial workflow** | Removed sharing and public handoff, using private app storage. A fully app-owned offline reader remains outstanding. |
| Full regression suite hit a 5-second timeout during the first invalid-token password-reset call while the database connection warmed. | **GREEN** | Confirmed the assertion passes in isolation and raised only that test’s deadline to 15 seconds; the security assertion and behavior were unchanged. |

## 3. Database and schema changes

| Migration | Change | Data effect |
|---|---|---|
| `drizzle/0009_stiff_tempest.sql` | Adds Developer role, Short comments, pending/rejected moderation states, source metadata, and related moderation fields. | Additive social-learning and role-isolation change. |
| `drizzle/0010_black_silver_fox.sql` | Adds `users.canUploadShorts boolean NOT NULL DEFAULT false`. | Additive only; existing accounts default to denied. |
| `drizzle/0011_yellow_vulture.sql` | Adds `educational_shorts.subjectCategory` with `General` fallback for existing records. | Additive only; enables moderation category filtering. |

The migrations were reviewed before application and the live schema was restored to the verified advanced checkpoint. The `canUploadShorts` field is non-null with default `0`; the Short moderation states, source metadata, comments, and `subjectCategory` are represented in the checked-in schema and migration chain.

## 4. API and security/RBAC changes

| Surface | Change | Security boundary |
|---|---|---|
| `student.shortUploadAccess` | Returns current Student upload eligibility. | Student-only procedure; active profile and database flag required. |
| `operations.setStudentShortUploadPermission` | Admin/Owner changes a Student’s upload eligibility. | Admin/Super Admin only; target must be a Student; every change creates an audit event. |
| `student.submitShort` | Checks `canUploadShorts` before persisting a submission. | Student role plus active, granted permission required; submissions remain `pending`. |
| `/api/media-upload` | Checks the same permission before accepting `purpose=student_short`. | Prevents bypassing the hidden client button with a direct multipart request. |
| Student root layout | Activates native capture prevention only for authenticated Student sessions. | Staff/Owner/Developer content is not unintentionally restricted; web is not falsely claimed as protected. |

> The client-side Upload button is a convenience control, not the authorization mechanism. The upload endpoint and submission mutation both independently repeat the database-backed permission check.

## 5. GREEN/RED verification report

| Area tested | Result | Evidence |
|---|---|---|
| TypeScript build | **GREEN** | Bounded `pnpm exec tsc --noEmit --pretty false` completed successfully after restoring the consistent schema/migration files. |
| Lint and automated regression/security suite | **GREEN** | `pnpm lint` and six test files completed successfully: **30 assertions** passed. The invalid-token password-reset check is resilient to first database connection latency. |
| Android bundle | **GREEN** | `expo export --platform android` succeeded and emitted the Android Hermes bundle. |
| API health | **GREEN** | `GET /api/health` returned `{"ok":true,...}` from the active API service. |
| User/Short schema migrations | **GREEN** | Verified migration chain includes 0009 social/moderation fields, 0010 default-false `canUploadShorts`, and 0011 `subjectCategory`; live database connectivity and schema metadata were checked during the release audit. |
| Developer passkey / Developer route isolation | **GREEN, server** | Existing focused passkey verifier and role-isolation regression coverage passed. |
| Owner isolation from Developer procedures | **GREEN, server** | Existing route and server checks remain in the passing regression suite. |
| Student/Teacher denial of Short permission grant | **GREEN, server** | New regression assertions reject Student and Teacher callers. |
| Default-denied Student Short submission | **GREEN, server** | New regression assertion rejects an ungranted Student submission. |
| Pending Short moderation rules | **GREEN, server** | Existing Admin/Super Admin-only moderation procedures and regression coverage remain passing. |
| Shorts viewability callback identity | **GREEN, build** | Stable `useRef` handler/configuration compiled in the Android export. |
| Empty Operations course response | **GREEN, server** | Helper has explicit `[]` fallback; existing Operations UI has an empty-course state. |
| Native capture prevention | **GREEN, build; RED for web guarantee** | Root native guard compiled; browsers cannot provide equivalent prevention and external-camera capture cannot be prevented. |
| Inline YouTube/Instagram Short playback | **GREEN, build; RED for universal provider guarantee** | WebView integration compiled. A provider may still block embeds, require login, or remove a video; the application renders an in-app unavailable state instead of redirecting. |
| Media upload progress/cancel feedback | **GREEN, build** | Shared XHR transport and Media Studio controls compiled; no physical-device file-transfer test was run in this sandbox. |
| Private offline PDF storage | **GREEN, boundary; RED for complete reader workflow** | Native sharing/browser handoff is removed and private storage is used. No in-app offline PDF reader currently reopens saved copies. |
| Navigation, every screen/button, device media, physical capture, upload cancellation | **RED — not fully verified** | A sandbox cannot complete exhaustive authenticated Android/iOS touch, gallery, camera, provider-login, and screen-recording walkthroughs. These remain explicitly listed in the verification matrix. |
| Payment, real SMS/email delivery, certificate issuance | **RED — credential/dependency incomplete** | Razorpay merchant/webhook credentials, provider credentials, and a certificate workflow are not configured or verified. |
| Shared-project baseline integrity | **GREEN** | Detected and repaired stale schema/migration divergence before final validation; the consistent advanced checkpoint now type-checks and the full 30-test suite passes. |

## 6. Remaining limitations and exact reason

1. **External embeds cannot be universally guaranteed.** YouTube and Instagram can deny embedding, require a provider login, restrict a region/age, or remove content. The native app now keeps failure inside the feed; it cannot override provider policy.
2. **Web capture prevention is not technically reliable.** Native Android/iOS prevention is mounted for Student sessions, but web browsers and another camera filming the display are outside application control.
3. **Private PDF files do not yet have an offline in-app reader.** The new private storage boundary prevents handoff, but a future dedicated reader is required to reopen stored files offline. The existing per-resource staff download policy should remain disabled for content that needs that complete workflow.
4. **A full physical-device audit was not performed in the sandbox.** Student submit → moderation → feed, native upload progress/cancel, share behavior, provider embeds, PDF storage, screenshot deterrence, and all touch navigation still need Android/iOS walkthroughs with real accounts and files.
5. **Razorpay, production OTP providers, AI provider responses, and certificates remain credential- or product-dependent.** Their secure boundaries remain intentionally non-faked.

## 7. Recommended next release-gate sequence

1. Run the physical-device checklist in `QA_VERIFICATION_MATRIX.md`, beginning with student upload permission grant/revoke, pending moderation, inline external playback, and native capture behavior.
2. Implement an internal PDF reader before enabling offline downloads for sensitive materials.
3. Configure Razorpay and verified webhooks only after merchant credentials are supplied; then run payment reconciliation and duplicate-webhook tests.

## Latest instruction-set continuation — 2026-08-19

| Requirement | Status | Evidence and limitation |
|---|---|---|
| Optional Gemini Doubt Solver | **GREEN, server and client wiring** | `GEMINI_API_KEY` is stored as a server-only project secret; the protected student `askAi` procedure calls the official Google Generative AI SDK with an Amin Ka Master educational-tutor system instruction and returns a safe fallback on provider failure. The key is never bundled into Expo client code. |
| Inline Shorts embeds and explicit external-open action | **GREEN, build** | Existing native WebView embeds remain in the vertical feed, and a clear `Open in YouTube` / `Open in Instagram` action now uses `Linking.openURL()` only after an explicit student tap. Provider login, policy, or embed restrictions remain outside application control. |
| Automated certificates | **GREEN, server and UI build** | The existing `certificates` schema is reused. Completing every published lesson for an enrolled course triggers one unique certificate record, exposes protected student listing/detail procedures, and adds an in-app certificate surface with print/save-to-PDF support. A real completion walkthrough still requires an authenticated device account and seeded course. |
| Secure internal offline PDF reader | **GREEN, boundary and UI build** | Authorized PDF access downloads only to `FileSystem.documentDirectory/protected-resources/` and opens through an in-app native WebView reader with capture deterrence; browser handoff is intentionally refused. Full offline reopen after app restart and physical-device PDF rendering remain pending device QA. |

The existing four-tier RBAC, Shorts moderation, comments/likes/saves, assessments, course management, upload permissions, and preview refresh workflow were preserved. No duplicate certificate table or schema migration was created because the checkpointed baseline already contained the `certificates` table and the current database model remains aligned.
