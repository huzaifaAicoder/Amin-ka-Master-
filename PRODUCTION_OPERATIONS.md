# Amin Ka Master — Production Operations Guide

## Purpose and operating model

**Amin Ka Master** is an authenticated LMS for Indian Amin and surveying preparation. Students use the learner portal for courses, recorded resources, Shorts, free playlists, live classes, tests, notes, bookmarks, and progress. Teacher, Admin, and Super Admin accounts use the Operations area. Routine curriculum and learner-management work does not require code changes.

| Role | Normal operating scope | Server-enforced boundary |
|---|---|---|
| Developer | Private platform branding, theme metadata, Developer details, and non-secret integration status | Cannot enter Student, Owner, Admin, Teacher, or Operations procedures; raw provider keys are never returned to the app |
| Student | Enroll in free courses, consume authorized learning content, take tests, save notes/bookmarks/Shorts | Cannot call staff or owner procedures |
| Teacher | Only responsibilities explicitly granted in **Teacher access** | No implicit course, media, test, or live-class authority |
| Admin | Course, media, assessment, live-class, moderation, PDF-audit, and per-student Short-upload management | Cannot modify Owner settings, staff credentials, passkeys, general people roles/status, or audit history |
| Owner (Super Admin) | Full business control for students, staff, courses, revenue operations, moderation, and audit review | Cannot access Developer Portal branding, theme, API configuration status, or Developer credentials |

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

### Developer Portal

The **Developer Portal** link appears discretely beneath the Student, Staff/Admin, and Owner cards on the public sign-in screen and opens the private **`/dev-portal`** route. Its first setup and each Developer login require the server-only `DEVELOPER_PORTAL_PASSKEY`; no fallback credential is permitted. Configure this strong passkey through the secure environment settings and retain it outside normal business staff channels. The portal stores display-only branding and theme metadata and presents only a configured/not-configured status for Gemini and Razorpay. It never displays or stores a raw provider credential in the mobile client.

> Owner and staff accounts are intentionally denied the Developer Portal at both route and API layers. Developer accounts are also denied Student and Operations routes.

### Refreshing live panels

The primary **Home**, **Explore**, **My Learning**, **Shorts**, **Account**, and **Operations** panels support a native pull-down refresh gesture. Pull down from the top of the content to refetch the panel’s active server data. Mounted queries also refresh when the app returns to the foreground, which keeps secondary routed panels current without running a background polling loop. Existing retry controls remain available for a failed individual request.

### Content and learning operations

Create catalog categories in **Teacher access → Manage course categories** before creating courses. Course creation, pricing, modules, lessons, PDFs, Free Playlists, Shorts, tests, and live classes are managed from Operations. Course prices must be entered in INR and the selling price may not exceed the MRP. In **Manage courses → Edit**, choose **Course status** (Draft, Published, or Archived) and then select **Save course changes**; the course-list status label is display-only and cannot silently change a course.

Course and playlist uploads are limited to video files and PDFs and are limited to 150 MB by the server. Media Studio sends an authenticated multipart request and now shows byte-level percentage progress, a visible **Cancel** action, and dismissible success/error confirmation. Cancelling stops the client transfer; it does not publish a draft or change existing content. The application is tuned for older Android devices and slower networks; use compressed, mobile-friendly video encodes and concise PDFs. Published managed media is delivered as a short-lived signed URL only after the student has passed the relevant authorization check. Direct `learning-media/` storage-proxy access is denied.

For a published or draft assessment, open **Operations → Manage tests → [test]** and choose **Edit** on a question card. Staff with the `assessments.manage` permission can update the prompt, all four options, correct option, marks, and the detailed learner explanation in one form. The correction and explanation remain hidden during a learner’s active attempt; they appear only in the secure post-submission review. The server also confirms that an edited question belongs to the selected test before saving.

Media Studio can additionally use explicitly selected **YouTube** or **Instagram** links for a video or Short. The server accepts only `youtube.com`, `youtu.be`, or Instagram Reel/video URL shapes; arbitrary external domains are rejected. On supported Android/iOS builds, Shorts render a privacy-reduced YouTube or Instagram embed inside the feed with a visible provider source tag and navigation restricted to that provider. The app does not launch an external browser or provider app. Providers can still block embeds, require login, or remove content; in those cases Amin Ka Master keeps the learner in the feed and renders an in-app unavailable notice rather than creating a broken redirect. Staff must own or have permission to share external content and follow provider licensing, age, and privacy rules.

### Student Shorts and moderation

The student Shorts feed supports tap-to-play/pause feedback, Like, Save, Share, and read/write Comments. Comment creation is restricted to Student identities and applies only to published Shorts. The **Upload** control is hidden and the corresponding media-upload and submission APIs are denied unless an Admin or Owner explicitly enables `canUploadShorts` for that active Student in **Operations → Student Short permissions**. An approved student’s video is stored under the isolated `student-short-submissions/` namespace and receives `pending` status. Student submissions must include a concise subject category, such as **Land Survey** or **Revenue Records**. It is not delivered to the public feed until an Admin or Owner opens **Operations → Moderate student Shorts** and explicitly approves it. The dedicated **Shorts moderation** dashboard provides a pending count, search, in-app video preview, submitter context, optional staff-only notes, pull-to-refresh, a newest/oldest upload-date toggle, and filter chips derived from submitted subject categories before **Approve & publish** or **Reject**. Rejection keeps the item out of the student feed and records the moderation decision plus optional staff-only note in audit history.

Do not use moderation for emergency takedown alone: where a file needs removal from storage or external services, follow the organisation’s incident process and provider-specific removal controls. Existing staff-authored Shorts retain their normal Draft, Published, and Archived lifecycle in Media Studio and Media Maintenance.

To permit a supplementary-note download, open **Operations → Course structure & lessons**, edit the relevant module resource, select **PDF note**, upload the PDF through protected storage, and enable **Allow enrolled students to download** before saving. Leave this control off unless the material is deliberately approved for offline distribution. Video resources cannot be made downloadable.

Student tests are scored server-side. On submission, the student receives the configured passing threshold, elapsed time, answer review, and any authored explanations. **Practice tests → Attempt history** shows the learner’s own most recent 60 attempts, including score, time used, completion state, and a detailed option-by-option review. Staff and other students cannot retrieve these records. The client timer triggers submission at zero; the server derives remaining time from the persisted start timestamp, records a stale timed-out attempt as expired, and never accepts answers after the permitted deadline.

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
| AI assistant or study generator | A student-only **Ask AI** placeholder screen and protected server mutation are available; no external model is called and the response is explicitly labelled as a placeholder | Select the required study workflow, prompts, safety review, rate limits, conversation-retention policy, and server-side model integration before enabling generated answers |
| Developer Portal | Private Developer setup/login and safe integration-status UI are implemented | `DEVELOPER_PORTAL_PASSKEY` must remain configured in secure server environment settings; raw AI/payment keys stay in their own server-only variables |

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

The authenticated Student session now mounts native `expo-screen-capture` protection at the root on supported Android and iOS devices, covering the learner portal in addition to the existing lesson, enrolled-course, and Shorts guards. This deters ordinary screenshots, recording, and Android app-switcher previews. It is intentionally not enabled on web, where browsers do not offer a reliable cross-browser equivalent.

> Screen-capture deterrence reduces casual copying; it does **not** guarantee piracy prevention. Another device can record a display, and platform capabilities vary by version and device.

Course media and resources are delivered through authorization-gated, short-lived signed URLs. A configurable download action exists only for a published **module PDF** for which staff explicitly enabled the per-resource download policy. The server rejects videos, unpublished resources, disabled policies, non-managed external URLs, inactive or expired enrollments, and non-student callers. Each successful download authorization creates a `resource_download_events` record containing the student, resource, PDF type, and timestamp before a fresh managed-storage signed URL is returned.

On Android and iOS, the app downloads an authorized PDF into the application’s private `documentDirectory/protected-resources/` storage. The share sheet and public browser handoff are disabled; web displays a native-app-required message instead of opening the signed URL. This is intentionally a per-resource action; there is no generic “download all” or download control for video. A future internal PDF-reader screen is still required before these offline private copies can be reopened through an app-owned viewer; until then, staff should keep the download policy off for material that requires a complete in-app offline reading workflow.

Admin and Super Admin accounts can review these records from **Operations → PDF download audit**. The read-only monitor shows the resource, course and module, learner identity, and Indian-formatted issuance time, with bounded loading of older records. Teachers are intentionally excluded because the list contains learner activity data. Use it to investigate approved-resource distribution; it does not expose file URLs or permit a record to be edited or deleted.

## Performance and capacity evidence

The application is designed to avoid obvious catalogue hot paths: course discovery has a status/category index; module and lesson ordering has composite indexes; sessions, enrollments, progress, and Shorts engagement have user- and resource-oriented indexes. Public catalogue requests no longer invoke managed cookie authentication when no bearer token or cookie exists, preventing avoidable runtime work and missing-session log noise for anonymous discovery traffic.

| Validation | Result | Interpretation |
|---|---:|---|
| Local public-catalog burst | 100/100 HTTP 200 responses at 20-way concurrency in 3.823 seconds | A bounded sandbox smoke test; not a production capacity claim. |
| Local health burst | 100/100 HTTP 200 responses at 20-way concurrency in 0.149 seconds | Confirms the lightweight service health route remains responsive in the sandbox. |
| Anonymous runtime-auth log delta | 0 new “Missing session cookie” entries across a 20-request catalogue burst | Confirms anonymous public traffic skips unnecessary managed-auth lookup. |

These results do **not** prove 10,000 concurrent users. Before that target can be claimed, run environment-representative load tests against production-like MySQL, storage/CDN, authentication, and video delivery infrastructure with observed latency, error rate, CPU, memory, database connections, and network throughput.

## Release checklist

Before publishing, verify that Owner Setup Code, Staff Passkey, database connectivity, storage, and any required OTP/payment provider variables are configured. Run TypeScript checking, the automated security suite, and an Android export. Confirm that an Owner can create a Teacher, grant only selected permissions, publish a free course resource, and that a Student can consume that resource only after enrollment. For the download policy, verify a protected uploaded PDF with the switch both off and on, verify the resulting audit event for an actively enrolled student, and confirm that the generated file can be saved on a real Android or iOS device. Save a checkpoint, then use the platform **Publish** action to create the release build.

> Razorpay/UPI credentials are the only remaining blocker for accepting live paid-course purchases. Until verified server-side payment handling is configured, paid-course access remains intentionally unavailable.
