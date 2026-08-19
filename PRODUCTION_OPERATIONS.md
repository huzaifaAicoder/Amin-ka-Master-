# Amin Ka Master — Production Operations Guide

## Purpose and operating model

**Amin Ka Master** is an authenticated LMS for Indian Amin and surveying preparation. Students use the learner portal for courses, recorded resources, Shorts, free playlists, live classes, tests, notes, bookmarks, and progress. Teacher, Admin, and Super Admin accounts use the Operations area. Routine curriculum and learner-management work does not require code changes.

| Role | Normal operating scope | Server-enforced boundary |
|---|---|---|
| Student | Enroll in free courses, consume authorized learning content, take tests, save notes/bookmarks/Shorts | Cannot call staff or owner procedures |
| Teacher | Only responsibilities explicitly granted in **Teacher access** | No implicit course, media, test, or live-class authority |
| Admin | Course, media, assessment, live-class, and operational management | Cannot modify Owner settings, staff credentials, passkeys, people, or audit history |
| Super Admin | Full operational control, staff creation, Teacher grants, settings, enrollment/review moderation, audit review | Private Owner Setup Code and Staff Passkey remain server-validated |

> The client UI is not an authorization boundary. Every sensitive action is checked again by the tRPC server.

## Routine operating procedures

### Owner setup and staff access

The first Owner account is created once through the Owner portal. It requires the **Private Owner Setup Code** and creates the initial Staff Passkey in the same server-side transaction. After that claim, additional Super Admin setup is not available through public registration.

Super Admin should create Teacher and Admin credential accounts from **Control Center → People**. A newly created Teacher has no Operations capability until the Owner opens the floating **Teacher access** shortcut inside Operations and grants the required responsibility. Grant only the smallest useful set of permissions.

| Teacher permission | Use when the Teacher needs to |
|---|---|
| `courses.manage` | Create or update course information |
| `courses.publish` | Publish, archive, or return courses to draft |
| `course_content.manage` | Manage modules, lessons, and attached course resources |
| `media.manage` | Publish Free Playlists and Shorts |
| `assessments.manage` | Create tests and questions |
| `assessments.publish` | Publish or archive tests |
| `live_classes.manage` | Schedule and update live classes |

Staff Passkey rotation is an emergency or scheduled security action. Rotation revokes active Teacher, Admin, and Super Admin sessions. Distribute a new passkey only through a confidential channel. Passwords, Owner codes, passkeys, payment secrets, database credentials, and provider API keys must never be placed in course text, announcements, audit metadata, or app settings.

### Content and learning operations

Create catalog categories in **Teacher access → Manage course categories** before creating courses. Course creation, pricing, modules, lessons, PDFs, Free Playlists, Shorts, tests, and live classes are managed from Operations. Course prices must be entered in INR and the selling price may not exceed the MRP.

Course and playlist uploads are limited to video files and PDFs and are limited to 150 MB by the server. The application is tuned for older Android devices and slower networks; use compressed, mobile-friendly video encodes and concise PDFs. Published managed media is delivered as a short-lived signed URL only after the student has passed the relevant authorization check. Direct `learning-media/` storage-proxy access is denied.

Student tests are scored server-side. On submission, the student receives the configured passing threshold, answer review, and any authored explanations. The client timer triggers submission at zero, while the server independently rejects attempts submitted after the permitted time.

## Credential-dependent integrations

The following boundaries are deliberately **not faked**. The relevant user experience is already protected and explains the missing connection.

| Capability | Current behavior | Production configuration still required |
|---|---|---|
| Paid course purchase / UPI | Paid enrollment remains blocked behind a verified-payment boundary | Razorpay integration, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, webhook secret, webhook endpoint, and verified event-to-enrollment logic |
| Indian SMS password recovery | Recovery challenge, throttling, hashing, expiry, attempt limits, and reset tokens are implemented | `OTP_DELIVERY_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, plus an approved MSG91 flow template |
| Email password recovery | Same secure recovery flow supports email | `OTP_DELIVERY_PROVIDER=resend`, `RESEND_API_KEY`, and `OTP_EMAIL_FROM` on a verified sender domain |
| Development-only OTP | Logs an OTP only outside production | Never set `OTP_DELIVERY_PROVIDER=development` in production |
| Managed storage | Upload and signed-download paths are implemented through the runtime storage service | Ensure built-in Forge storage credentials are available in the deployment runtime; do not replace with public bucket URLs |
| Browser CORS | Local and managed preview origins are accepted during development | Set `CORS_ALLOWED_ORIGINS` to the comma-separated production web origins before publishing a web build |
| AI assistant or study generator | No learner-facing AI feature is exposed | Select the required study workflow, prompts, safety review, and server-side model integration before enabling an AI feature |

## Security and data operations

Authentication uses scrypt password hashes, opaque hashed session tokens, revocable database sessions, and server-side role checks. Password reset OTPs are hashed, expire after ten minutes, are rate-limited, and have a finite verification-attempt limit. Session revocation occurs after password resets and Staff Passkey rotation.

The data model is migrated with Drizzle. Apply migrations through the project’s migration workflow and inspect generated SQL before applying it to production. Do not use destructive database commands to repair application data. Use the database management interface or an approved backup workflow for operational recovery.

| Operational event | Required response |
|---|---|
| Suspected staff credential exposure | Rotate Staff Passkey, suspend the affected account if necessary, review audit history, then issue new credentials privately |
| Suspected student credential exposure | Use password recovery or suspend the account; reset revokes active sessions |
| Media uploaded in error | Unpublish or replace the related course, playlist, or Short record; do not rely on obscurity of the file path |
| Payment dispute | Review the provider’s verified payment event and order state; do not manually mark an order paid from the client |
| Production web origin changes | Update `CORS_ALLOWED_ORIGINS`, restart services, and validate authentication plus protected media |

## Content capture and download controls

Authorized lesson screens now enable the native `expo-screen-capture` protection while mounted on supported Android and iOS devices. This deters ordinary screenshots, recording, and Android app-switcher previews. It is intentionally not enabled on web, where browsers do not offer a reliable cross-browser equivalent.

> Screen-capture deterrence reduces casual copying; it does **not** guarantee piracy prevention. Another device can record a display, and platform capabilities vary by version and device.

Course media and resources are delivered through authorization-gated, short-lived signed URLs. The current product does **not** expose a configurable “download lecture” control, because there is no approved per-resource download policy, audit model, or offline-file lifecycle yet. Do not add a generic Share action for protected course media. If downloads are approved, add an explicit per-resource permission, a server-authorized download action, activity logging, expiry behavior, and device-side file handling before enabling it.

## Performance and capacity evidence

The application is designed to avoid obvious catalogue hot paths: course discovery has a status/category index; module and lesson ordering has composite indexes; sessions, enrollments, progress, and Shorts engagement have user- and resource-oriented indexes. Public catalogue requests no longer invoke managed cookie authentication when no bearer token or cookie exists, preventing avoidable runtime work and missing-session log noise for anonymous discovery traffic.

| Validation | Result | Interpretation |
|---|---:|---|
| Local public-catalog burst | 100/100 HTTP 200 responses at 20-way concurrency in 3.823 seconds | A bounded sandbox smoke test; not a production capacity claim. |
| Local health burst | 100/100 HTTP 200 responses at 20-way concurrency in 0.149 seconds | Confirms the lightweight service health route remains responsive in the sandbox. |
| Anonymous runtime-auth log delta | 0 new “Missing session cookie” entries across a 20-request catalogue burst | Confirms anonymous public traffic skips unnecessary managed-auth lookup. |

These results do **not** prove 10,000 concurrent users. Before that target can be claimed, run environment-representative load tests against production-like MySQL, storage/CDN, authentication, and video delivery infrastructure with observed latency, error rate, CPU, memory, database connections, and network throughput.

## Release checklist

Before publishing, verify that Owner Setup Code, Staff Passkey, database connectivity, storage, and any required OTP/payment provider variables are configured. Run TypeScript checking, the automated security suite, and an Android export. Confirm that an Owner can create a Teacher, grant only selected permissions, publish a free course resource, and that a Student can consume that resource only after enrollment. Save a checkpoint, then use the platform **Publish** action to create the release build.

> Razorpay/UPI credentials are the only remaining blocker for accepting live paid-course purchases. Until verified server-side payment handling is configured, paid-course access remains intentionally unavailable.
