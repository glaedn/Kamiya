import { describe, expect, it } from "vitest";
import { isAllowedOrigin, parseAllowedOrigins } from "./corsPolicy";

describe("Kamiya CORS policy", () => {
  it("allows both local web clients by default", () => {
    const allowedOrigins = parseAllowedOrigins("");

    expect(allowedOrigins).toEqual([
      "http://localhost:5173",
      "http://localhost:3000"
    ]);
    expect(isAllowedOrigin("http://localhost:5173", allowedOrigins)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", allowedOrigins)).toBe(true);
  });

  it("uses the configured allowlist without admitting arbitrary origins", () => {
    const allowedOrigins = parseAllowedOrigins(
      " https://kamiya.example, https://resonera.example,https://kamiya.example "
    );

    expect(allowedOrigins).toEqual([
      "https://kamiya.example",
      "https://resonera.example"
    ]);
    expect(isAllowedOrigin("https://attacker.example", allowedOrigins)).toBe(false);
  });

  it("allows requests without a browser Origin header", () => {
    expect(isAllowedOrigin(undefined, [])).toBe(true);
  });
});
