# Developer Portal Security Boundary

The application distinguishes **Developer**, **Owner**, **Admin/Staff**, and **Student** accounts. A Developer is a root platform operator, an Owner manages one business and its learners/content, Admin and Teacher accounts perform delegated business operations, and Students access learning and submit content for moderation.

| Tier | Server-authorized responsibilities | Explicitly excluded responsibilities |
| --- | --- | --- |
| Developer | Branding configuration, developer metadata, integration status, platform-level audit review | Routine course, learner, and staff operations unless separately granted in a future business scope |
| Owner | Business users, staff, courses, revenue review, moderation, and business settings | Developer portal, raw API keys, branding/theme configuration, and integration credentials |
| Admin/Staff | Delegated courses, media, assessment, live-class, and moderation work | Developer configuration, Owner-only people/security controls, and raw credentials |
| Student | Learning, authorized Shorts interaction, comments, and private Short submission | Publication, moderation, staff operations, settings, and other users’ submission data |

> Raw payment, AI, storage, and other provider credentials remain server-only environment secrets. The Developer Portal reports configuration state but never renders, accepts, stores, or returns a raw key through the mobile client.

Developer access is isolated from Student and Staff login. A separate Developer Portal route requires a Developer identity plus a server-only `DEVELOPER_PORTAL_PASSKEY`; first-account provisioning is one-time and unavailable until that server secret is configured.
