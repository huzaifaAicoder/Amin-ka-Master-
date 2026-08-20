# Production-Readiness Boundaries

## Study Coach protected report flow

The checked code path creates a Study Coach report only on Android or iOS. It creates the app-private `protected-resources/` directory, writes the PDF there, and opens it in the internal PDF reader. The reader now accepts only `file://` paths inside that private folder and applies the existing screen-capture guard. Browser export remains intentionally unavailable.

The automated regression suite verifies the source-level private-storage, internal-reader, capture-protection, and error-handling boundaries. A signed-in Android and iOS device test is still required to verify the operating-system print implementation, real app-private storage behavior, PDF rendering, and native capture enforcement in a standalone build.

## Study Coach notices

The Study Coach notice preference is opt-in and stored per Student. Enabling it now creates one private in-app confirmation notification and an audit record. The current application does not claim to run automatic scheduled reminders; future recurring reminders require a separately approved background-notification design and device validation.

## Razorpay and UPI reconciliation

Business Intelligence intentionally reports only stored order and payment-readiness states. It does not infer revenue or reconciliation status. Real paid-course activation and reconciliation remain blocked until the Developer configures server-side Razorpay credentials, a verified webhook endpoint, signature verification, and an approved UPI payment-status mapping. Credentials must remain server-only and must never be entered into a mobile client screen.

## Privacy-approved operational telemetry

The Developer can now explicitly enable aggregate API latency and aggregate crash telemetry from Root Control. API data is bucketed hourly by a fixed endpoint group and status class; crash data is bucketed hourly by fixed platform, route-group, and error-class categories. The system does not store user IDs, device identifiers, IP addresses, raw paths, tRPC operation names, request bodies, headers, error messages, stack traces, Student content, files, or credentials. Buckets are automatically removed after 30 days.

Crash reporting begins only for authenticated sessions after the Developer enables it. API instrumentation begins only after the Developer enables it. Private-storage metering and device performance telemetry remain uninstrumented. No simulated latency, crash, storage, or performance values are shown.
