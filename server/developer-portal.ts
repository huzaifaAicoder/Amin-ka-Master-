import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isDeveloperPortalConfigured() {
  return Boolean(process.env.DEVELOPER_PORTAL_PASSKEY?.trim());
}

export function verifyDeveloperPortalPasskey(candidate: string) {
  const configured = process.env.DEVELOPER_PORTAL_PASSKEY?.trim();
  if (!configured || !candidate) return false;
  return timingSafeEqual(digest(configured), digest(candidate));
}
