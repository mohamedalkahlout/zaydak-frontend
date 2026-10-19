import { describe, expect, it } from "vitest";
import { safeRedirect } from "../redirect";

describe("safeRedirect (admin)", () => {
  const fallback = "/users";

  it("allows a plain relative path", () => {
    expect(safeRedirect("/shops", fallback)).toBe("/shops");
  });

  it("allows a relative path with query string", () => {
    expect(safeRedirect("/users?role=admin", fallback)).toBe("/users?role=admin");
  });

  it("falls back when raw is missing or empty", () => {
    expect(safeRedirect(null, fallback)).toBe(fallback);
    expect(safeRedirect(undefined, fallback)).toBe(fallback);
    expect(safeRedirect("", fallback)).toBe(fallback);
  });

  it("rejects full external URLs", () => {
    expect(safeRedirect("https://evil.example", fallback)).toBe(fallback);
    expect(safeRedirect("http://evil.example", fallback)).toBe(fallback);
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.example", fallback)).toBe(fallback);
  });

  it("rejects backslash authority bypasses", () => {
    expect(safeRedirect("/\\evil.example", fallback)).toBe(fallback);
  });

  it("rejects non-http schemes", () => {
    expect(safeRedirect("javascript:alert(1)", fallback)).toBe(fallback);
    expect(safeRedirect("data:text/html,<script>alert(1)</script>", fallback)).toBe(fallback);
  });
});
