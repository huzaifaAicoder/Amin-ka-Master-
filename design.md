# Amin Ka Master — Mobile Interface & Product Architecture

## Product intent

**Amin Ka Master** is a portrait-first Indian EdTech LMS for land-Amin preparation, land measurement, surveying, revenue records, and practical field training. The mobile product must make a student’s next learning step easy to find with one hand, while giving authorised staff the ability to operate courses, learning content, tests, live classes, and communications without source-code changes.

The first delivery focuses on the high-value, end-to-end learning workflow: discover a published course, enroll when permitted, resume a lesson, persist progress, take a timed MCQ test, receive in-app notices, and review account learning history. Administrative functions use the same app with a protected operations area and are enforced on the server; the interface never decides permissions.

## Mobile design direction

The visual language is **survey-field precision with academic warmth**. It uses a deep indigo foundation, saffron learning accents, and cartographic green for completion states. Layouts are designed for a 9:16 portrait viewport: primary actions live in the lower half of the screen or in a bottom sheet, tap targets are at least 44 points, and the bottom navigation stays limited to four student destinations.

| Token | Value | Intended use |
| --- | --- | --- |
| Field indigo | `#14213D` | Primary navigation, headings, trusted institutional tone |
| Survey saffron | `#F2A541` | Primary calls to action, active progress, key learning moments |
| Paper | `#FFFDF8` | Main surface and readable long-form content |
| Contour green | `#287A5A` | Completion, verified enrollment, success feedback |
| Earth | `#805B3B` | Secondary emphasis and field-training context |
| Ink | `#1D252D` | High-contrast body text |
| Mist | `#EEF1F4` | Dividers, quiet backgrounds, inactive controls |

The student experience uses rounded but restrained cards, clear numeric progress, strong typography, and real empty/loading/error states. Decorative imagery is limited to contextual course cover art and the branded launcher icon; learning status must never rely on color alone.

## Screen list and content behavior

| Screen | Primary content | Primary actions |
| --- | --- | --- |
| Welcome / sign in | App value, email-or-mobile credential entry, account creation and recovery entry points | Register, sign in, continue as visitor |
| Home | Greeting, continue-learning card, upcoming live class, category rail, featured published courses, notices | Resume lesson, open course, open notification |
| Explore | Search box, category chips, published course results, pricing and access labels | Search, filter, open course details |
| Course detail | Cover, instructor, learning benefits, modules, lesson count, access price, reviews | Enroll, begin preview, read review summary |
| My learning | Enrolled courses with exact progress and entitlement state | Resume, view certificate if eligible |
| Lesson player | Authorized lesson content, video/text resource area, previous/next actions, progress, bookmark and private notes | Mark complete, save note, navigate lesson |
| Tests | Assigned/published tests with timing and attempts | Start test, submit, see result and explanation |
| Test attempt | One MCQ at a time, visible timer, answer state, submission confirmation | Select answer, move between questions, submit |
| Live classes | Authorized upcoming, live and completed classes | Open meeting link only when entitled, read recording attachment |
| Notifications | In-app announcements and course updates | Mark read, navigate to linked learning item |
| Account | Profile, learning history, certificates, saved notes and bookmarks, secure sign-out | Update profile, manage active sessions, log out |
| Operations dashboard | Role-specific operational summary: students, courses, enrollments, upcoming classes and recent activity | Navigate to management areas |
| Course management | Course/category/module/lesson list with publishing and reorder boundaries | Create or edit permitted content |
| Test & live management | Tests, questions, schedules, attendee access boundaries | Create/edit permitted content |
| CMS & announcements | Banners, contact detail, general settings, announcements and moderation | Publish approved content / send targeted notice |

## Key user flows

**Student discovery and enrollment:** The user opens Explore, searches or selects a category, opens a published course and sees the access type. A free course can create a server-authorized enrollment immediately. A paid course creates a pending order, then waits for payment verification on the server. The app never unlocks a paid course from a browser/app success callback alone.

**Learning and continuity:** From Home or My Learning, the student taps Resume. The lesson screen requests the course entitlement and lesson visibility from the server, loads the authorized material, restores last watched position when supported, and records completion/progress through a validated mutation. Bookmarks and notes are stored per student and never shared.

**Assessment:** The student opens a published, authorized test, confirms the time limit, answers MCQs, and submits. The server derives the score from stored answer keys, saves the attempt, and returns the result; the mobile client never sends a claimed score.

**Operations:** An authenticated member enters Operations only if a server-issued role and granular permission allow it. Super Admin can govern roles and settings. Admin and Teacher screens render only allowed actions, but every mutation repeats the same role/permission check on the server.

## Technical architecture and trust boundaries

The mobile client is an Expo Router application using TypeScript, a type-safe API client, secure native credential storage and a dedicated server. The server uses validated input schemas, MySQL through Drizzle ORM, and storage references for future protected files. Authentication is a custom email-or-mobile/password account flow with salted `scrypt` password hashes and revocable opaque session tokens; the existing platform sign-in remains optional and is not treated as a substitute for the requested student credentials.

| Layer | Responsibility | Security rule |
| --- | --- | --- |
| Mobile application | Navigation, rendering, optimistic feedback, secure token storage | Never stores roles as authority or calculates purchase/test access |
| API procedures | Input validation, role/permission checks, entitlement checks, idempotent business actions | All protected procedures derive the actor from the authenticated session |
| Database | Users, roles, content hierarchy, enrollments, activity and audit records | Unique keys and transactions prevent duplicate enrollments/orders/attempt corruption |
| Storage boundary | File metadata and future resource/video delivery | Only authorized procedures resolve protected asset access |
| Payment boundary | Provider order creation, webhook verification and reconciliation | Client payment status alone cannot enroll a student |

## Core database model

The schema uses explicit ownership, publication state, entitlement boundaries and auditability. Content is not seeded as a permanent hard-coded business rule; starter records are sample data that can be managed by authorized operators.

| Domain | Main entities |
| --- | --- |
| Identity & access | `users`, `auth_sessions`, `role_permissions`, `teacher_permissions`, `audit_logs` |
| Course catalog | `categories`, `courses`, `course_modules`, `lessons`, `lesson_resources`, `course_reviews` |
| Learning | `enrollments`, `lesson_progress`, `bookmarks`, `personal_notes`, `certificates` |
| Assessments | `tests`, `questions`, `test_attempts`, `test_answers` |
| Live & messaging | `live_classes`, `notifications`, `announcements`, `app_settings` |
| Commerce | `orders`, `payment_events`, `coupons` |

## API and authorization shape

Public procedures are limited to registration, login, published catalog discovery and allowed previews. Authenticated procedures cover a student’s profile, active sessions, learning data, free enrollment, progress, notes, test submissions, reviews and authorized live-class listings. Operations procedures use `requireRole` and `requirePermission` middleware for every route that mutates catalog, assessments, users, CMS, payments, or operational configuration.

The implementation retains a payment-provider interface with explicit `createOrder`, `verifyPayment`, and `handleWebhook` boundaries. Razorpay credentials and webhook signing secret are intentionally not requested or embedded until an operator is ready to connect a live payment account. Email delivery follows the same principle; in-app notifications are fully supportable without external credentials, while transactional email is a configured extension.

## Risks and delivery boundaries

The requested product is broad enough to be a multi-release LMS. Payment capture, live-video hosting, email delivery, video DRM, and actual file uploads require providers or credentials outside the project. The implementation must expose the operational data model and verified execution boundary now, while documenting those provider-dependent functions as **blocked by external configuration** rather than simulating them.

## Implementation sequence

1. Establish the database schema, custom session model, role enforcement, seed content and server-side learning procedures.
2. Build the student-facing mobile information architecture with real data states for catalog, enrollment, learning, tests and account history.
3. Add protected operations flows for course, test, live-class, notification and CMS management based on permission checks.
4. Add payment and provider adapters without storing credentials in code, then add external provider configuration when supplied.
5. Validate user flows, permission denial paths, input validation, empty database handling, and app visual behavior on mobile dimensions.

