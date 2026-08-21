import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Staff and Owner Account route recovery", () => {
  it("keeps Account role-aware while leaving every other Student tab protected", () => {
    const root = read("app/_layout.tsx");
    expect(root).toContain('const isStudentTabRoute = rootSegment === "(tabs)" && segments[1] !== "account"');
    expect(root).toContain("const isStudentPortalRoute = isStudentTabRoute");
    expect(root).toContain('user && user.role !== "student" && user.role !== "developer" && isStudentPortalRoute');
  });

  it("keeps Student learning shortcuts out of Staff and Owner Account views", () => {
    const account = read("app/(tabs)/account.tsx");
    expect(account).toContain("{!staff ? <View><Text style={styles.sectionTitle}>Learning</Text>");
    expect(account).toContain('label="Operations dashboard"');
    expect(account).toContain('label="Course manager"');
    expect(account).toContain('label="Test manager"');
  });
});
