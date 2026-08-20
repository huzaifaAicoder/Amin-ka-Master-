# Authentication Repair Audit

## Initial client findings

The shared session provider persists the issued token and user record before setting the local authenticated user state. It also queries the authenticated `auth.me` endpoint immediately after token availability and reports a loading state while that query remains pending.

The unified Staff sign-in handler submits the existing `auth.login` request with `portal: "staff"` and the required Staff Passkey, awaits session persistence, then redirects to `/operations`. Its busy state is mutation-derived only; it has no request deadline, retry action, or explicit recovery path for a request that remains unresolved.

The Developer sign-in handler in the existing Developer Control Center separately awaits server login, shared session completion, and `router.replace("/dev-portal")`. The actual route guard and server result still need to be audited before identifying a root cause.

The root authentication guard treats `/dev-portal` as a Developer route, waits while shared session hydration reports loading, redirects authenticated Developers away from non-Developer routes, and redirects non-Developers away from Developer routes. It does not issue an explicit redirect when an authenticated Developer is already on `/dev-portal`; therefore a persistent Developer loading state or a failed `auth.me` revalidation can prevent the existing portal from appearing even when the button handler reaches `router.replace`.

The authenticated transport reads the session token per request, so a token stored by `completeLogin` is available to a subsequent request. The shared provider nevertheless defines loading as any active `auth.me` fetch after a token exists and clears the local session on every `auth.me` error, including a transient network failure. This can obscure the portal immediately after successful login. The Staff screen also derives its button busy state directly from unbounded mutation pending flags, so an unresolved network request has no visible timeout or explicit retry recovery.

## Confirmed repair

The shared provider now retains a newly verified local identity while `auth.me` revalidates and only clears that identity when the server identifies the session as unauthorized. This allows successful Developer and Staff login responses to establish the local session and reach their existing protected routes immediately, while preserving server-enforced authorization and the 401 invalidation path.

The existing Staff and Developer requests retain their server-side passkey validation, session issuance, and destinations. Their client lifecycle now has a 15-second visible wait boundary, clear network feedback, and duplicate-request ownership. A delayed request may still finish securely, but it cannot leave an indefinite spinner or create duplicate sessions through repeated taps.

## Validation boundary

TypeScript, lint, and 76 deterministic regression assertions verify the session, passkey, redirect, timeout, and protected-route contracts. A physical or authenticated preview sign-in using a real Developer and Staff credential cannot be performed without those private credentials; this is intentionally not bypassed or simulated.
