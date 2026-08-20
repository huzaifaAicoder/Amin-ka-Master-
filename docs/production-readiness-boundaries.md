# Production-Readiness Boundaries

## Study Coach protected report flow

The checked code path creates a Study Coach report only on Android or iOS. It creates the app-private `protected-resources/` directory, writes the PDF there, and opens it in the internal PDF reader. The reader now accepts only `file://` paths inside that private folder and applies the existing screen-capture guard. Browser export remains intentionally unavailable.

The automated regression suite verifies the source-level private-storage, internal-reader, capture-protection, and error-handling boundaries. A signed-in Android and iOS device test is still required to verify the operating-system print implementation, real app-private storage behavior, PDF rendering, and native capture enforcement in a standalone build.

## Study Coach notices

The Study Coach notice preference is opt-in and stored per Student. Enabling it now creates one private in-app confirmation notification and an audit record. The current application does not claim to run automatic scheduled reminders; future recurring reminders require a separately approved background-notification design and device validation.

## Razorpay and UPI reconciliation

Business Intelligence intentionally reports only stored order and payment-readiness states. It does not infer revenue or reconciliation status. Real paid-course activation and reconciliation remain blocked until the Developer configures server-side Razorpay credentials, a verified webhook endpoint, signature verification, and an approved UPI payment-status mapping. Credentials must remain server-only and must never be entered into a mobile client screen.

## Privacy-approved operational telemetry

The Client Health dashboard currently reports only persisted aggregate usage and configuration/release signals. It intentionally labels crash reporting, API latency, storage metering, and performance telemetry as uninstrumented. Before adding telemetry, the product should define the purpose, retention, opt-in/consent model where applicable, data minimisation, access controls, and deletion process. No simulated latency, crash, or storage values should be shown before that instrumentation is implemented and validated.
