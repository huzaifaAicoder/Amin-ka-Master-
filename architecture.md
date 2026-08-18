# Amin Ka Master — Build Architecture

## Delivery status vocabulary

| Label | Meaning |
| --- | --- |
| Implemented | The flow has code, persistent data handling, and validation in this project. |
| Partially implemented | A usable foundation exists, but one or more required operational surfaces remain to be completed. |
| Blocked by external credential | The code boundary is prepared but cannot contact a live provider without an operator-owned credential. |
| Future feature | Deliberately deferred from the initial release scope. |

## Integration decisions

| Capability | Initial decision | Status |
| --- | --- | --- |
| Student credentials | Native email-or-mobile/password flow with revocable server sessions | Planned implementation |
| Payment | Provider interface built for Razorpay verification and idempotent webhook handling | Blocked by provider credentials |
| Email | Notification delivery interface with in-app notices first | Blocked by email provider credentials |
| Video | Provider/storage abstraction with entitlement checks around metadata and resource resolution | Partially implemented until a streaming provider is selected |
| Live class | Meeting URL and recording metadata with course-entitlement checks | Implementable without a video-provider credential |
| Push | Deferred; in-app inbox provides the initial notification channel | Future feature |

## Security rules that guide implementation

1. Every mutating request uses server-side validation and the authenticated session, not role or price data supplied by the client.
2. Passwords are salted and hashed; raw passwords and session tokens are never persisted in readable form.
3. Free enrollment, payment finalization and course access are idempotent and validated against publishing and entitlement state.
4. Course, lesson, resource, test, live-class and review access is checked for the acting user and relevant enrollment before data is returned.
5. Administrative functions require a server-side role plus a specific permission where relevant. All administration actions create audit records.
6. Provider secrets belong in the runtime environment only. The mobile bundle contains no provider secret, webhook secret, database password or privileged service credential.

## Required verification matrix

| Scenario | Expected result |
| --- | --- |
| Unauthenticated user requests protected learning data | Request is rejected with `UNAUTHORIZED`. |
| Student requests another student’s notes/progress | Request is rejected or returns only their own records. |
| Student tampers with a course price or role in a request | Server ignores client assertions and uses database records/session role. |
| Client reports payment success without verified provider record | No paid enrollment is created. |
| A duplicate verified payment event is replayed | A unique event/order constraint preserves one enrollment. |
| Unpublished or expired course is requested | Access is denied unless a permitted operator is accessing management data. |
| Invalid test answer payload is sent | Validation rejects the request; the server derives score from saved answers. |
| Invalid dangerous file is proposed for upload | The upload boundary rejects unsupported type/size before storage write. |
