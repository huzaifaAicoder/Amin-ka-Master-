# Amin Ka Master — Implementation & Handoff

## What is implemented

The project is an Expo mobile LMS with a server-backed MySQL/Drizzle data model. The initial delivery implements a student workflow from public catalog discovery through authenticated enrollment, protected lesson access, persisted learning activity, timed MCQ assessment, live-class visibility, notifications, and session management. An authorized operations dashboard exposes server-derived operational metrics and course publication state.

| Area | Included in this delivery |
| --- | --- |
| Identity | Email-or-mobile/password registration and login, salted `scrypt` password hashes, revocable opaque sessions, OTP-based password recovery, reliable device sign-out, and sign-out-everywhere. |
| Roles | Student, Teacher, Admin, and Super Admin role values with server-side role middleware and delegated teacher permissions. |
| Course catalog | Managed categories, course status, editable pricing/access attributes, modules, lessons, module-level recorded videos, PDF notes, and resources. Public discovery exposes published records only. |
| Learning | Server-validated enrollment, protected lesson access, watched/completion progress, private notes, and bookmarks. |
| Assessments | Server-issued questions, persisted attempts/answers, server-derived scores, duplicate-submission protection, and server-enforced attempt expiry. |
| Live and communications | Entitlement-filtered live-class schedule and a per-user in-app notification inbox. |
| Operations | Role-gated metrics, direct course pricing edits, module media attachment, Free Playlist and Shorts management, publishing controls, category API, and audit records for managed actions. |
| Mobile experience | Home, Explore, Free Playlists, My Learning, vertical Shorts, Account, course, lesson, tests, test attempt, live-class, notifications, active-session, and operations screens. |
| Support and information | Account-accessible Help & Support, Contact Us, and Developer Details screens, with official contact and developer information configured only by Super Admin. |

## Demonstration accounts

These are **non-production seed accounts** included solely to make feature review practical. Replace or delete them before any public deployment.

| Role | Identity | Password | Intended review |
| --- | --- | --- | --- |
| Student | `student@aminkamaster.demo` | `AminMaster!2026` | Free enrollment, lesson progress, test attempt, notifications and sessions. |
| Teacher | `teacher@aminkamaster.demo` | `AminMaster!2026` | Operations dashboard and delegated course-management permissions. |
| Super Admin | `admin@aminkamaster.demo` | `AminMaster!2026` | Full operations view and protected administrative APIs. |

## Admin entry path

An account with the **Teacher**, **Admin**, or **Super Admin** role is now sent directly to **Operations** after sign-in. From there, select **Manage courses** to create a draft course, edit the title, summary, category, access type and pricing for any existing course, and cycle its publication state between draft, published and archived. The same **Manage courses** shortcut is also shown prominently at the top of the Account tab for every staff role.

## Security controls

> The mobile client renders the experience; the server decides identity, role, publishing state, entitlement, price, assessment access, score, and staff permission.

| Control | Implementation |
| --- | --- |
| Password storage | Passwords are persisted only as per-user salt + `scrypt` derived hashes. Raw password values are not persisted by the application. |
| Session safety | Each session is an opaque, hashed record with expiry and revocation. Sign-out everywhere deletes every server record for the current account. |
| Authorization | Protected procedures derive the actor from server-authenticated session context. The role in a mobile payload is not trusted. |
| Ownership boundaries | Notes, bookmarks, learning progress, notifications, test attempts and answer data are filtered by the authenticated user ID. |
| Paid access | The app does not unlock paid courses from a client success event. It deliberately blocks payment capture until provider verification and signed webhook configuration are supplied. |
| Assessments | Correct answers do not leave the assessment endpoint. Scores are calculated from database answer keys. Attempt timeout is also enforced server-side. |
| Operations | Teacher, Admin and Super Admin content-management APIs repeat role validation and emit audit records for course, module-resource, Free Playlist and Shorts mutations. Owner-only actions remain separately protected. |
| Learning media | Owner, Admin and Teacher uploads are authenticated, MIME-restricted to video or PDF, limited to 150 MB, persisted outside the mobile bundle, and tracked through server-side metadata. Published course resources remain enrollment-gated; Free Playlists remain available only to registered users. |
| Account recovery | Recovery requests are privacy-preserving. OTP codes are six digits, HMAC-hashed at rest, expire after 10 minutes, become unusable after verification, and allow only five verification attempts. A successful reset receives a short-lived, one-time server token and revokes all existing sessions. |
| Staff Passkey | Teacher, Admin and Super Admin login requires a second, server-validated Staff Passkey after credential authentication. The active key is persisted only as a salted `scrypt` hash; it is never returned by an API or rendered in student-facing views. |
| Staff Passkey rotation | Only Super Admin can rotate the key. Rotation verifies the current key server-side, revokes the prior hashed key, creates a new hash, writes an audit event without secret values, and invalidates every active staff session. |
| Staff account onboarding | Super Admin can create Teacher or Admin accounts from **Control Center → People** with an official email or Indian mobile number and a strong initial password. The action is audited; public registration cannot create staff accounts. |
| First owner setup | Before the first usable Super Admin is available, the sign-in landing screen presents **First owner setup**. It is a one-time server-guarded flow that verifies `OWNER_SETUP_CODE`, creates the Super Admin credentials, and establishes the first hashed Staff Passkey together. It is not a public staff-registration route. |
| Logout resilience | Account sign-out always clears native secure storage, cached user state and authenticated query state, even if an intermittent network failure prevents server revocation from completing. Server-side revocation remains the normal path. |

## Provider boundaries and required configuration

The project deliberately does not include hard-coded payment, email, streaming or storage credentials.

| Capability | Current boundary | Needed before production activation |
| --- | --- | --- |
| Razorpay payments | Client presents an explicit configuration boundary; no payment currently unlocks a paid course. | `RAZORPAY_KEY_ID`, server-only `RAZORPAY_KEY_SECRET`, signed webhook verification, reconciliation and refund policy. |
| Transactional email | In-app inbox works without external services. | An approved email provider, sender domain, templates, opt-out policy, and server-only credentials. |
| Password recovery OTP | The mobile flow and server-side challenge lifecycle are implemented. Delivery is intentionally disabled until a provider is configured; the app never returns an OTP to a mobile client. | Select either `OTP_DELIVERY_PROVIDER=msg91` with `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` for Indian SMS, or `OTP_DELIVERY_PROVIDER=resend` with `RESEND_API_KEY` and `OTP_EMAIL_FROM` for verified email delivery. A non-production `OTP_DELIVERY_PROVIDER=development` option writes codes only to protected server logs for local testing. |
| Staff Passkey bootstrap | The first active Staff Passkey must be established without a hard-coded client secret. | Set server-only `STAFF_PASSKEY_BOOTSTRAP` through application secrets. An existing Super Admin uses it at first Staff/Admin Login, after which the database-managed key is active. Rotate it from **Control Center → Security**; do not rely on the bootstrap value after activation. |
| Video and PDF delivery | Authenticated Owner/Admin/Teacher uploads can attach recorded video and PDF content to modules, Free Playlists, and Shorts through protected managed storage. The app uses a single active player in the Shorts feed to limit device work and opens PDFs through platform document viewers. | A production streaming/CDN provider, signed playback URLs, transcoding/vertical-video profiles, malware scanning, lifecycle retention policy, and bandwidth monitoring before large-scale distribution. |
| Live meetings | Authorized schedule and link metadata are supported. | Approved meeting provider account, host process and, if required, recording retention rules. |
| Push notifications | Intentionally deferred. | Expo push token lifecycle, backend send policy and user consent/notification preference flows. |

## Production release checklist

1. Rotate/delete every demonstration account and establish an initial Super Admin through a controlled runbook.
2. Configure production environment secrets through the application secret settings—not in the source tree or mobile bundle.
3. Select and configure payment, email, streaming and live-class providers; add signed webhook verification before exposing checkout.
4. Apply a privacy policy, terms, refund policy, content ownership policy, instructor agreement and user support contact details via CMS settings.
5. Configure, test and monitor the account-recovery delivery provider before opening registration to the public. Do not enable the development delivery mode in production.
6. Store a strong `STAFF_PASSKEY_BOOTSTRAP` only in secret settings, complete the first Super Admin bootstrap, then rotate and distribute the database-managed Staff Passkey through an approved confidential process.
7. Distribute Staff Passkeys and any Owner Setup Code only through approved confidential channels. If Staff/Admin self-registration is enabled, review new Teacher accounts and elevate roles only through protected Super Admin controls.
8. On a fresh deployment, use **First owner setup** with the private `OWNER_SETUP_CODE` to create the first Super Admin account and Staff Passkey. The option disappears after a successful claim. Do not share the Owner Setup Code with staff or students.
6. Carry out penetration testing, abuse/rate-limit testing, device/session review, database backups and disaster-recovery rehearsals.
7. Add internal dashboards for payment reconciliation, failed notification delivery, moderation queue and audit-log review.

## Test evidence

The automated suite verifies password hashing behavior, OTP expiry and single-use rejection, brute-force attempt blocking, invalid recovery-token rejection, server cookie cleanup on logout, server-only bootstrap passkey validation, rejection of ordinary Admin passkey rotation, rejection of unauthenticated learning access, and rejection of student access to operations routes. TypeScript compilation and Android bundle export were executed after the support, authentication and Staff Passkey updates.

## Known scope boundaries

The requested specification covers a full commercial LMS. The current delivery includes authenticated file uploads and baseline video/PDF playback, but it does not yet include a production video CDN/transcoding pipeline, signed streaming URLs, live-video host, push-notification service, certificate renderer, or a comprehensive browser-based CMS. The recovery user interface and secure server lifecycle are complete, while live OTP delivery remains a provider configuration step. The database and server authorization boundaries are established for these extensions, and the current UI makes their configuration requirement explicit instead of falsely displaying completed transactions or media playback.
