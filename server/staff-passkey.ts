import { timingSafeEqual } from "node:crypto";

function equalSecrets(left: string, right: string) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isStaffPasskeyBootstrapConfigured() {
  return Boolean(process.env.STAFF_PASSKEY_BOOTSTRAP?.trim());
}

/** Server-only comparison for the one-time Super Admin bootstrap secret. */
export function verifyStaffPasskeyBootstrap(candidate: string) {
  return equalSecrets(candidate, process.env.STAFF_PASSKEY_BOOTSTRAP ?? "");
}
