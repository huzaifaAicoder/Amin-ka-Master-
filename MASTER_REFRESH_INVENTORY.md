# Amin Ka Master — Master Refresh Inventory

**Baseline:** Current shared source was compared with advanced checkpoint `2b10676e`. Every route present in that checkpoint is present in the active tree. The active head also contains subsequent targeted media, authentication, and Developer control changes.

| Area | Current evidence | Status | Verification / reconciliation action |
|---|---|---|---|
| Authentication and role separation | `app/auth.tsx`, `server/routers.ts`, passkey/setup-code tests | Present | Automated authentication, passkey, owner-setup, and logout tests pass. Physical role walkthrough remains required. |
| Student navigation | `app/(tabs)/_layout.tsx` includes Home, Explore, My Learning, Shorts, Downloads, Account | Present | Downloads was restored from the advanced checkpoint and remains feature-aware. |
| Student Home and learning | `app/(tabs)/index.tsx`, `learning.tsx`, `course/[slug].tsx`, `lesson/[lessonId].tsx` | Present | Requires authenticated device walkthrough with real course data. |
| Shorts and moderation | `shorts.tsx`, `operations/moderation.tsx`, student Shorts procedures | Present, recently hardened | URL parser tests pass. Provider playback remains physical-device/provider dependent. |
| Offline PDFs | `course/[slug].tsx`, `downloads.tsx`, `pdf-reader.tsx`, resource authorization helper | Present | Private temporary-file promotion and internal reader flow verified in source/tests. |
| Offline managed video | `offline-media.tsx` and prior UI present | Regressed server authorization | Active schema/policy records PDF-only resource download audit events; restore authorized video route without weakening enrollment/publication checks. |
| AI Doubt Solver | `ask-ai.tsx`, server AI procedure, Gemini secret test | Present | Advanced chat UI was restored. Live provider and keyboard/device behavior remain to be verified. |
| Courses, categories, lessons, resources | Course, structure, category, media Operations routes; server procedures | Present | Requires role-based CRUD walkthrough. |
| Tests and attempt history | `tests.tsx`, `test/[testId].tsx`, `test-history.tsx`, Operations tests routes | Present | Requires staff CRUD and Student timed attempt walkthrough. |
| Live classes and notices | `live.tsx`, `notifications.tsx`, Operations live route | Present | Requires scheduling/publish/navigation walkthrough. |
| Owner and staff operations | `operations.tsx` plus control, permissions, media, courses, tests, moderation routes | Present | Server role enforcement is covered by security suite; UI walkthrough remains. |
| Developer Portal and white-label controls | `dev-portal.tsx`, Developer settings procedures, root user helpers | Present | Restored advanced tabbed controller; confirm current Developer navigation and all live setting propagation. |
| Screen-capture protection | Root/Shorts/course/PDF/offline viewer screen-capture guards | Present with platform limits | Must verify on Android/iOS; web cannot enforce native capture protection. |
| Feature flags and maintenance | Managed settings plus tab/home/AI consumption | Present, needs runtime audit | Validate cross-session refresh/invalidation and Developer maintenance bypass. |
| Payments | Course payment boundary / configuration-ready flow | Configuration-ready, not live | No payment must be treated as successful until provider credentials and webhook verification are configured. |
| Land utilities, GPS, case studies, analytics | No verified route/procedure evidence in current route inventory | Not verified / likely missing | Do not claim implemented; assess only after P0 reconciliation and QA. |

## Current automated verification

`pnpm check` passes. The current test suite has 35 passing assertions across logout, Developer passkey secrecy, Gemini secret boundary, Student/role security, URL validation, owner setup, staff passkey bootstrap, and centralized YouTube URL parsing. Lint has four pre-existing hook warnings in lesson and moderation paths; there are no lint errors.

## Master Refresh QA Evidence

| Workflow | Result | Evidence / limitation |
|---|---|---|
| Student/role authorization boundary | **GREEN (automated)** | 24 LMS security assertions pass, including role-protected paths and enrollment checks. |
| PDF private download integrity | **GREEN (source + regression)** | Signed authorization, `.partial` temporary target, completion/size check, cleanup, app-private library, and in-app PDF viewer are present. Device interruption testing remains pending. |
| Managed-video private download authorization | **GREEN (schema + source)** | Re-enabled only for active Student enrollment, published module/resource, `downloadAllowed`, and managed storage. Database enum was confirmed as `enum('pdf','video')`. Device viewer walkthrough remains pending. |
| YouTube URL parsing | **GREEN (automated)** | Four parser assertions cover Shorts, youtu.be, watch URLs, and malformed input. |
| YouTube/Instagram inline embeds | **AMBER** | Active-item-only WebView lifecycle and failure fallback are implemented. Actual provider rendering depends on physical Android/iOS device, provider policy, account state, and runtime WebView support. |
| Ghost-audio prevention | **AMBER** | Managed videos pause when inactive; provider WebViews are only mounted for active page. Rapid-scroll, app-background, and navigation tests require a device. |
| Fullscreen lesson video | **AMBER** | Native fullscreen control is implemented; Android back/return lifecycle needs device validation. |
| AI Doubt Solver | **GREEN (automated boundary) / AMBER (device UX)** | Credential-boundary test passes and advanced UI is present; keyboard and live provider behavior require device/provider test. |
| Courses, tests, live classes, notices | **AMBER** | Route and server-procedure coverage are present. Full Owner/Teacher/Student CRUD and navigation walkthrough requires authenticated QA accounts. |

## Confirmed reconciliation decisions

1. Retain the restored `2b10676e` Student Downloads, offline viewer, advanced AI, Developer Portal, and feature-aware tab implementations rather than rebuilding them.
2. Retain newer centralized YouTube parsing, active-WebView lifecycle control, and provider-failure fallback.
3. Restore managed-video offline authorization as a targeted P0 repair rather than rolling back database or authorization changes.
4. Treat third-party provider playback and native capture protection as device/provider-dependent until validated on Android and iOS.
