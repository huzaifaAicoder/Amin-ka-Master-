import { timingSafeEqual } from "node:crypto";

function equalSecrets(left: string, right: string) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isOwnerSetupConfigured() {
  return Boolean(process.env.OWNER_SETUP_CODE?.trim());
}

/** Server-only comparison for the one-time owner account claim. */
export function verifyOwnerSetupCode(candidate: string) {
  return equalSecrets(candidate, process.env.OWNER_SETUP_CODE ?? "");
}
