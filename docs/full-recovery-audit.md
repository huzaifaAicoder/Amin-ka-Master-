# Full Recovery and Regression Audit

## Preservation decision

The current project remained the baseline. Project history, the current route tree, role guards, server procedures, schema, migrations, protected media helpers, AI route, and existing regression suites were compared before any repair. No database reset, destructive migration, broad rollback, dashboard replacement, or RBAC rewrite was performed.

## Confirmed regression restored

| Area | Status | Root cause | Restoration | Verification |
|---|---|---|---|---|
| Staff/Owner Account surface | **[✓] Restored and verified** | The root guard classified every `(tabs)` route as Student-only, even though Account has a pre-existing Staff/Owner operations branch. The branch existed but could not be reached by a valid Staff or Owner identity. | Only the Account tab is exempt from the non-Student Student-tab redirect. Student-only learning shortcuts are hidden for Staff/Owner Account views; all other Student tabs remain protected. | TypeScript, direct source guard tests, full regression suite, and server role middleware review. |

## Preserved system matrix

| Functional area | Status | Evidence |
|---|---|---|
| Student authentication, session hydration, logout, routing | **[✓] Existing and automated coverage** | `auth-navigation-recovery`, `auth.logout`, `staff-passkey.bootstrap`, and security suites. |
| Student Home, Explore, My Learning, Courses, lessons, progress, notes, bookmarks, resources, PDFs | **[✓] Existing and automated coverage** | Route inventory plus learning, production-hardening, and security regression suites. |
| Shorts/Reels, external provider policy, like/save/offline Hub, managed download/share, one-item paging | **[✓] Existing and automated coverage** | Reels Hub, follow-up, YouTube, media URL, and interaction repair suites. |
| Offline Library, private storage, retry/search, incomplete-file handling | **[✓] Existing and automated coverage** | Offline library resilience and production-hardening suites. |
| AI Doubt Solver, text, image/camera vision preparation, image preview, keyboard, pending feedback, Hindi labels | **[✓] Existing and automated coverage** | AI interaction, attached UX, secret boundary, and student-language suites. |
| Amin Toolkit, state-first converter, GPS history, approved land portals, compass | **[✓] Existing and automated coverage** | Amin Toolkit, attached upgrades, and learning-upgrade suites. |
| Timed tests, AI Quiz, results, history, explanations, PDF export/review flow | **[✓] Existing and automated coverage** | AI Quiz, results PDF, and learning-experience suites. |
| Live classes, notifications, guardian consent/report boundaries, wellbeing | **[✓] Existing and automated coverage** | Guardian, wellbeing, and related LMS security suites. |
| Staff Operations: courses, content structure, media, tests, live, moderation, download audit | **[✓] Existing and source/automated coverage** | Operations route, role-aware actions, delegated server procedures, LMS security suite. |
| Owner Control Center: people, business, settings, Staff Passkey, announcements, audit | **[✓] Existing and source/automated coverage** | Owner control route, owner-only middleware, owner setup-code and growth suites. |
| Developer Portal: Overview, Health, Branding, Access, Users, Templates, Content, Audit | **[✓] Existing and automated coverage** | Protected Developer portal, root-control, advanced-control, white-label, and audit suites. |
| RBAC, passkey protection, server-side protected resources, Developer/Owner isolation | **[✓] Existing and automated coverage** | `server/_core/trpc.ts`, LMS security, Developer passkey, Owner setup, and source guard suites. |
| Database/schema/migrations | **[✓] Preserved** | Current schema retains user, content, enrollment, test, media, offline audit, AI, notifications, role, telemetry, template, and audit tables; migrations `0000`–`0019` remain intact. No data operation was performed. |

## Validation results

| Gate | Result |
|---|---|
| TypeScript | **[✓] Passed** |
| Automated regression | **[✓] 128 tests across 36 files passed** |
| Lint | **[✓] No errors; four documented pre-existing hook warnings remain** |
| Public preview entry | **[✓] Rendered after service restart** |
| Authenticated physical Android/iOS flows | **[~] Requires real credentials and physical devices** |

## Native and credential boundaries

The sandbox cannot truthfully claim authenticated physical-device verification for private Developer, Owner, Staff, and Student credentials, native keyboard timing, protected native files, screen-capture behavior, device GPS/sensors, system share sheets, or third-party provider WebViews. Existing Android/iOS runbooks retain those steps. No mock identity, fake AI result, or bypass was introduced to simulate them.
