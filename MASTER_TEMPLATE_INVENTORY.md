# Amin Ka Master — Master Template Inventory

**Purpose.** This document records the verified reference implementation that must remain intact while the Developer Studio gains separate client-project provisioning. It is a preservation baseline, not a rebuild specification.

| Area | Verified reference capability | Preservation boundary |
| --- | --- | --- |
| Identity and roles | Password/session authentication with Developer, Owner, Admin/Teacher, and Student boundaries; server-side passkey/setup-code checks where applicable | Client configuration must never copy live users, password hashes, sessions, passkeys, or setup codes. |
| Student learning | Course discovery, enrolled learning, protected lessons/resources, progress, bookmarks, tests, AI Quiz, AI Doubt Solver, certificates, notifications, Shorts, likes/comments/saves, Downloads, and offline viewers | Existing Student routes, protected-media behavior, and capture protections remain reference behavior. |
| Staff and Owner operations | Course/module/lesson/resource management, MCQ testing, live classes, media, moderation, and content controls with server authorization | The template studio may describe capability profiles; it must not replace operational procedures. |
| Developer controls | Branding, app settings, global feature switches, maintenance mode, user/role control, individual matrices, safe View As, content controls, and audit CSV export | Master controls remain Developer-only. New project records are metadata and do not grant cross-project account access. |
| Data and security | MySQL/Drizzle schema, private resource storage, secure server-only provider credentials, audited critical actions, and protected download/video/PDF paths | A client project manifest excludes provider secrets, database credentials, auth secrets, payment secrets, webhooks, and production media URLs. |
| Media and offline | Active-item Shorts embed strategy, provider fallback, in-app PDF/offline video viewing, authorized private downloads | A separate client release package can enable supported modules, but cannot bypass provider/embed or native capture-platform limits. |

## White-Label Extension Contract

The **Master Template** is a protected snapshot of the feature architecture and supported configuration schema. A **Client Project** is an isolated provisioning manifest that contains only editable, non-sensitive settings: display identity, visual theme, supported feature profile, role-navigation profile, public-page copy, and release metadata.

Client Project records do **not** clone the master database, production users, passwords, passkeys, sessions, provider credentials, webhook secrets, audit history, or live content. They create a configuration package for a separate project to provision. Final separate-project creation and APK generation are deliberate platform release actions, not background actions performed inside a Student-facing mobile screen.

## Verified Extension Points

The Developer router already owns root-only settings, user controls, feature controls, audits, content status, and server-only integration status. The new studio extends this router with project-manifest operations. Global settings continue to power the current master application; Client Project configuration is stored separately so editing a client manifest cannot alter Amin Ka Master.

## Release Boundary

The Developer Studio may mark a client project as **draft**, **ready for review**, or **release prepared**, and produce a non-sensitive release manifest. It must not invoke autonomous publishing, issue an APK directly, or expose provider credentials. A Developer uses the platform's project/release interface to provision the separate project and then uses its **Publish** control after review and checkpointing.
