# Production-Readiness Boundaries

## Study Coach protected report flow

The checked code path creates a Study Coach report only on Android or iOS. It creates the app-private `protected-resources/` directory, writes the PDF there, and opens it in the internal PDF reader. The reader now accepts only `file://` paths inside that private folder and applies the existing screen-capture guard. Browser export remains intentionally unavailable.

The automated regression suite verifies the source-level private-storage, internal-reader, capture-protection, and error-handling boundaries. A signed-in Android and iOS device test is still required to verify the operating-system print implementation, real app-private storage behavior, PDF rendering, and native capture enforcement in a standalone build.

## Study Coach notices

The Study Coach notice preference is opt-in and stored per Student. Enabling it now creates one private in-app confirmation notification and an audit record. The current application does not claim to run automatic scheduled reminders; future recurring reminders require a separately approved background-notification design and device validation.

## Razorpay and UPI reconciliation

Business Intelligence intentionally reports only stored order and payment-readiness states. It does not infer revenue or reconciliation status. Real paid-course activation and reconciliation remain blocked until the Developer configures server-side Razorpay credentials, a verified webhook endpoint, signature verification, and an approved UPI payment-status mapping. Credentials must remain server-only and must never be entered into a mobile client screen.

## Privacy-approved operational telemetry

The Developer can explicitly enable aggregate API latency, aggregate authentication latency, and aggregate crash telemetry from Root Control. API data is bucketed hourly by a fixed endpoint group and status class; authentication data uses the single fixed `auth` group and only aggregate count, total duration, maximum duration, and HTTP status class; crash data is bucketed hourly by fixed platform, route-group, and error-class categories. The system does not store user IDs, account identities, roles, device identifiers, IP addresses, raw paths, tRPC operation names, request bodies, headers, passwords, passkeys, error messages, stack traces, Student content, files, or credentials. Buckets are automatically removed after 30 days.

Crash reporting begins only for authenticated sessions after the Developer enables it. API instrumentation begins only after the Developer enables it. Authentication latency begins only after its separate Developer toggle is enabled and is measured server-side around the existing Student/Staff and Developer sign-in procedures; it does not bypass or alter passkey checks, session creation, sign-out, or route guards. Private-storage metering and device performance telemetry remain uninstrumented. No simulated latency, crash, storage, or performance values are shown.

## Native Toolkit and offline-library validation boundary

Automated tests cover region-scoped unit rules, official-host allowlisting, local saved-plot routing, native image-crop configuration, completion-only private downloads, retry records, and local title search. A real signed-in Android/iOS test is still needed to validate the operating system's location permission prompt, native Crop / Adjust interface, actual filesystem interruption/resume behavior, WebView behavior for each state portal, and device-specific GPS accuracy. The application shows a native retry explanation when a portal or download fails rather than claiming provider availability or fabricating a completed file.
