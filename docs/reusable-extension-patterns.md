# Reusable Extension Patterns

## Additive region-specific calculation

Land units are modeled as a selectable system plus supported-unit list, rather than a global conversion table. Standard metric/imperial units are always available. A local unit is available only when a reviewed system supplies its square-metre reference. This prevents the UI from representing a Bigha, Katha, or Dhur value as valid outside the selected context.

## Explicit local persistence

GPS perimeter points remain in screen state by default. `persistSavedPlot` is invoked only after the Student actively names and saves the map, and writes the minimum local object to AsyncStorage. `loadSavedPlots` and `removeSavedPlot` provide restart-safe view/delete behavior without an API route, server database row, telemetry, or audit event.

## Completion-only private downloads

`downloadAuthorizedOfflineResource` is the sole private-resource download helper. It receives a freshly authorized short-lived URL, writes to a disposable `.pending-` file, verifies non-zero completed bytes, and then moves the file into `protected-resources/`. The Downloads screen never treats a pending file as completed. Failure records contain only resource ID, title, local kind, timestamp, and user-facing failure text; they never retain a signed URL. Retrying requests a fresh authorization and promotes only a new completed file.

## Consent-first aggregate authentication timing

Authentication timing reuses the existing hourly latency table. A separate Developer setting gates the fixed `auth` route group. The server measures only wall-clock duration and HTTP status class around existing generic Student/Staff and Developer sign-in mutations. It does not attach role, identity, session ID, passkey, password, payload, path, error message, or provider content. Client Health reports only aggregate count, average, and maximum over the last 24 hours; automatic cleanup retains at most 30 days.

## Reviewed in-app government portals

Every portal requires an exact allowlisted government host. The WebView blocks off-directory navigation, remains in-app, and renders a native retry explanation for connection or HTTP errors. Adding a portal requires a documented government-domain review and a regression assertion, not a user-provided URL or an open browser handoff.
