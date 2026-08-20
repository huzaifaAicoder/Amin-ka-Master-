# Amin Ka Master: Permanent Feature Preservation Standard

> **Master-version principle.** The current working application is the protected master version. Every future change must be additive and backward-compatible unless the project owner explicitly authorizes removal of a named feature.

## Non-negotiable development rule

No task may remove, disable, downgrade, overwrite, reset, replace, or make an existing working feature non-functional. This applies to all panels, routes, databases, APIs, authentication, permissions, white-label configuration, navigation, media, AI, offline learning, security controls, and release workflows.

| Required behavior | Standard |
|---|---|
| New features | Extend the existing implementation and reuse equivalent systems where available. Do not create duplicate routes, permissions, tables, or components unnecessarily. |
| Bug fixes | Change only the affected implementation and preserve existing user flows whenever possible. |
| Refactors | Preserve observable behavior, supported routes, role boundaries, and data contracts. |
| Database work | Use reviewed additive migrations. Never reset, drop, or destructively replace production data or working schema behavior without explicit owner authorization. |
| Feature conflicts | Identify the conflict and select a compatible design. If no safe path exists, stop and report the conflict before any destructive action. |

## Mandatory pre-change preservation audit

Before editing code for any future task, the implementation owner must inspect the current related route, data model, API, permissions, navigation path, feature flags, and connected user flows. The smallest safe change should then be selected.

If a feature appears absent, do not assume it was intentionally removed. First determine whether it is hidden by role access, authentication, a feature flag, an alternate route, a disconnected navigation entry, or an earlier checkpoint. Restore or reconnect a previously working implementation safely instead of rebuilding a weaker substitute.

## Protected capability categories

The following categories are explicitly protected, in addition to every other working capability in the project: Student, Teacher/Admin, Owner, and Developer panels; authentication and passkeys; RBAC; courses, lessons, progress, tests, Shorts, media playback, capture protection, downloads, offline learning, AI Doubt Solver and Vision input, live classes, notifications, audit logs, Developer settings, feature flags, white-label projects, templates, preview/release workflows, existing navigation, and existing database/API contracts.

## Completion and reporting gate

A task is complete only when the new behavior works, the directly related existing behavior still works, authorization and navigation remain correct, data is preserved, and no existing capability has been silently removed or downgraded.

Every future delivery must state what was added, what was modified, which existing behavior was preserved, the relevant files/routes/components changed, the tests and regressions performed, whether any existing feature was affected, and any item that could not be implemented safely.
